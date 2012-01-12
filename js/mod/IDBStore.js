/*
 * a fork of Jens Arps's IDBWrapper(http://jensarps.de/), adding ozjs's event module 
 * Licensed under the MIT (X11) license
 */

define('IDBStore', ['event'], function(Event){

	var IDBStore;
	
	var defaults = {
		dbName: 'IDB',
		storeName: 'Store',
		dbVersion: '1.0',
		keyPath: 'id',
		autoIncrement: true,
		onStoreReady: function(){}
	};
	
	IDBStore = function(kwArgs, onStoreReady){
		mixin(this, defaults);
		mixin(this, kwArgs);
		onStoreReady && (this.onStoreReady = onStoreReady);
		this.idb = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
		this.consts = window.IDBTransaction || window.webkitIDBTransaction || window.msIndexedDB;
        this.event = Event();
		this.openDB();
	};
	
	IDBStore.prototype = {
		
		db: null,
		
		dbName: null,
		
		dbDescription: null,
		
		dbVersion: null,
		
		store: null,
		
		storeName: null,
		
		keyPath: null,
		
		autoIncrement: null,
		
		features: null,
		
		onStoreReady: null,
		
		openDB: function(){
			var openRequest = this.idb.open(this.dbName, this.dbDescription);
			openRequest.onerror = function(error){ console.error('Could not open database.', error); };
			openRequest.onsuccess = hitch(this, function(event){
				this.db = event.target.result;
				this.checkVersion(hitch(this, function(){
					this.getObjectStore(hitch(this, function(){
						this.testFeatures(this.onStoreReady);
					}));
				}));
			});
		},
		
		testFeatures: function(callback){
			var features = this.features = {};
			
			// In Chrome, there's no getAll method (getAll is not part of the spec, but handy)
			var getAllTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
			features.hasGetAll = !!getAllTransaction.objectStore(this.storeName).getAll;
			getAllTransaction.abort();
			
			// In FF, autoIncrement doesn't work.
			// We won't test for that, as testing
			// sometimes fails in Chrome (it's a long
			// story).
			features.hasAutoIncrement = !window.mozIndexedDB;
			
			callback && callback();
		},


		/**************
		 * versioning *
		 **************/
		
		checkVersion: function(onSuccess, onError){
			if(this.getVersion() != this.dbVersion){
				this.setVersion(onSuccess, onError);
			}else{
				onSuccess && onSuccess();
			}
		},
		
		getVersion: function(){
			return this.db.version;
		},
		
		setVersion: function(onSuccess, onError){
			onError || (onError = function(error){ console.error('Failed to set version.', error); });
			var versionRequest = this.db.setVersion(this.dbVersion);
			versionRequest.onerror = onError;
			versionRequest.onblocked = onError;
			versionRequest.onsuccess = onSuccess;
		},


		/*************************
		 * object store handling *
		 *************************/ 


		getObjectStore: function(onSuccess, onError){
			if(this.hasObjectStore()){
				this.openExistingObjectStore(onSuccess, onError);
			}else{
				this.createNewObjectStore(onSuccess, onError);
			}
		},
		
		hasObjectStore: function(){
			return this.db.objectStoreNames.contains(this.storeName);
		},
		
		createNewObjectStore: function(onSuccess, onError){
			this.setVersion(hitch(this, function(){
				this.store = this.db.createObjectStore(this.storeName, { keyPath: this.keyPath, autoIncrement: this.autoIncrement});
				onSuccess && onSuccess(this.store);
			}), onError);
		},
		
		openExistingObjectStore: function(onSuccess, onError){
			var emptyTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
			this.store = emptyTransaction.objectStore(this.storeName);
			onSuccess && onSuccess(this.store);
		},
		
		deleteObjectStore: function(onSuccess, onError){
			onError || (onError = function(error){ console.error('Failed to delete objectStore.', error); });
			this.setVersion(hitch(this, function(){
				this.db.deleteObjectStore(this.storeName);
				var success = !this.hasObjectStore();
				onSuccess && success && onSuccess();
				onError && !success && onError();
			}), onError);
		},


		/*********************
		 * data manipulation *
		 *********************/


		put: function(dataObj, onSuccess, onError){
            var self = this;
			if(typeof dataObj[this.keyPath] == 'undefined' && !this.features.hasAutoIncrement){
				dataObj[this.keyPath] = this._getUID();
			}
			var putTransaction = this.db.transaction([this.storeName], this.consts.READ_WRITE);
			var putRequest = putTransaction.objectStore(this.storeName).put(dataObj);
            putRequest.onsuccess = function(event){ 
                if (onSuccess) {
                    onSuccess(event.target.result); 
                }
                self.event.fire('put', [event.target.result]);
            };
            putRequest.onerror = function(){
                if (onError) {
                    onError.apply(this, arguments);
                }
                self.event.error('put', arguments);
            };
            return this.event.promise('put');
		},
		
		get: function(key, onSuccess, onError){
            var self = this;
			var getTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
			var getRequest = getTransaction.objectStore(this.storeName).get(key);
            getRequest.onsuccess = function(event){ 
                if (onSuccess) {
                    onSuccess(event.target.result); 
                }
                self.event.fire('get', [event.target.result]);
            };
            getRequest.onerror = function(){
                if (onError) {
                    onError.apply(this, arguments);
                }
                self.event.error('get', arguments);
            };
            return this.event.promise('get');
		},
		
		remove: function(key, onSuccess, onError){
            var self = this;
			var removeTransaction = this.db.transaction([this.storeName], this.consts.READ_WRITE);
			var deleteRequest = removeTransaction.objectStore(this.storeName).delete(key);
            deleteRequest.onsuccess = function(event){ 
                if (onSuccess) {
                    onSuccess(event.target.result); 
                }
                self.event.fire('remove', [event.target.result]);
            };
            deleteRequest.onerror = function(){
                if (onError) {
                    onError.apply(this, arguments);
                }
                self.event.error('remove', arguments);
            };
            return this.event.promise('remove');
		},
		
		getAll: function(onSuccess, onError){
            var self = this;
			var getAllTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
            var onSuccessFn = function(event){ 
                var result = event.target && event.target.result || event.length && event || [];
                if (onSuccess) {
                    onSuccess(result); 
                }
                self.event.fire('getAll', [result]);
            };
            var onErrorFn = function(){
                if (onError) {
                    onError.apply(this, arguments);
                }
                self.event.error('getAll', arguments);
            };
			if(this.features.hasGetAll){
				var getAllRequest = getAllTransaction.objectStore(this.storeName).getAll();
                getAllRequest.onsuccess = onSuccessFn;
                getAllRequest.onerror = onErrorFn;
			}else{
				this._getAllCursor(getAllTransaction, onSuccessFn, onErrorFn);
			}
            return this.event.promise('getAll');
		},
		
		_getAllCursor: function(tr, onSuccess, onError){
			var all = [];
			var store = tr.objectStore(this.storeName);
			var cursorRequest = store.openCursor();
			
			cursorRequest.onsuccess = function(event) {
				var cursor = event.target.result;
				if (cursor) {
					all.push(cursor.value);
					cursor.continue();
				}
				else {
					onSuccess(all);
				}
			};
			cursorRequest.onError = onError;
		},
		
		clear: function(onSuccess, onError){
            var self = this;
			var clearTransaction = this.db.transaction([this.storeName], this.consts.READ_WRITE);
			var clearRequest = clearTransaction.objectStore(this.storeName).clear();
            clearRequest.onsuccess = function(event){ 
                if (onSuccess) {
                    onSuccess(event.target.result); 
                }
                self.event.fire('clear', [event.target.result]);
            };
            clearRequest.onerror = function(){
                if (onError) {
                    onError.apply(this, arguments);
                }
                self.event.error('clear', arguments);
            };
            return this.event.promise('clear');
		},
		
		_getUID: function(){
			// FF bails at times on non-numeric ids. So we take an even
			// worse approach now, using current time as id. Sigh.
			return +new Date();
		},
		
		
		/************
		 * indexing *
		 ************/
		
		createIndex: function(indexName, propertyName, isUnique, onSuccess, onError){
            var self = this;
			propertyName || (propertyName = indexName);
			this.setVersion(hitch(this, function(evt){
				var index = evt.target.result.objectStore(this.storeName).createIndex(indexName, propertyName, { unique: !!isUnique });
                if (onSuccess) {
                    onSuccess(index);
                    self.event.fire('createIndex', [index]);
                }
            }), function(){
                if (onError) {
                    onError.apply(this, arguments);
                }
                self.event.error('createIndex', arguments);
            });
            return this.event.promise('createIndex');
		},
		
		getIndex: function(indexName){
			return this.store.index(indexName);  
		},
		
		getIndexList: function(){
			return this.store.indexNames;
		},
		
		hasIndex: function(indexName){
			return this.store.indexNames.contains(indexName);
		},
		
		removeIndex: function(indexName, onSuccess, onError){
            var self = this;
			this.setVersion(hitch(this, function(evt){
				evt.target.result.objectStore(this.storeName).deleteIndex(indexName);
                if (onSuccess) {
                    onSuccess();
                    self.event.fire('removeIndex');
                }
			}), function(){
                if (onError) {
                    onError.apply(this, arguments);
                }
                self.event.error('removeIndex', arguments);
            });
            return this.event.promise('removeIndex');
		},
		
		/* key ranges / cursors */
		// TODO: implement
		
	};
	
	/** helpers **/
	
	var noop = function(){};
	var empty = {};
	var mixin = function(target, source){
		var name, s;
		for(name in source){
			s = source[name];
			if(s !== empty[name] && s !== target[name]){
				target[name] = s;
			}
		}
		return target;
	};
	var hitch = function (scope, method){
		if(!method){ method = scope; scope = null; }
		if(typeof method == "string"){
			scope = scope || window;
			if(!scope[method]){ throw(['method not found']); }
			return function(){ return scope[method].apply(scope, arguments || []); };
		}
		return !scope ? method : function(){ return method.apply(scope, arguments || []); };
	};
	
	return IDBStore;

}, this);
