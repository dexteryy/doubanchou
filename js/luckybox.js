
define("luckybox", [
    "lang",
    "host",
    "browsers",
    "event",
    "template",
    "IDBStore",
    "dialog"
], function(_, host, browsers, Event, tpl, IDBStore, Dialog){

    var M = Math,
        BOX_W = 750,
        BOX_H = 400,
        CARD_WIDTH = 100,
        CARD_HEIGHT = 40,

        TRANSFORM_STYLE = ({
            "mozilla": "-moz-transform",
            "webkit": "-webkit-transform",
            "opera": "-o-transform",
            "msie": "-ms-transform"
        })[browsers.browser] || "transform",

        TRANSFORM_ORIGIN_STYLE = ({
            "mozilla": "-moz-transform-origin",
            "webkit": "-webkit-transform-origin",
            "opera": "-o-transform-origin",
            "msie": "-ms-transform-origin"
        })[browsers.browser] || "transform-origin",

        TPL_CARD = '<a href="#uid={{uid}}" class="card"'
                + 'style="left:{{x}}px;top:{{y}}px;' 
                + 'width:{{w}}px;height:{{h}}px;line-height:{{h}}px;'
                + TRANSFORM_ORIGIN_STYLE + ':left top;' 
                + TRANSFORM_STYLE + ':rotate({{rotate}}deg);"><span class="card">{{title}}</span></a>',

        random_opt = {
            width: CARD_WIDTH + 5,
            height: CARD_HEIGHT + 5,
            spaceWidth: BOX_W,
            spaceHeight: BOX_H,
            record: [] 
        },

        uuid = 1,

        luckybox = {

            init: function(opt){
                var self = this;
                this.event = Event();
                this.dialog = Dialog({
                    titile: "",
                    content: "",
                    width: 400,
                    autoupdate: true,
                    isHideMask: false,
                    isTrueShadow: true,
                    buttons: []
                });
                try {
                    this.db = new IDBStore({
                        dbName: 'appdb',
                        storeName: 'Visitors',
                        keyPath: 'uid',
                        autoIncrement: true,
                        onStoreReady: function(){
                            if (opt.defaultDB) {
                                self.db.getAll().then(function(rows){
                                    if (opt.reset || !rows.length) {
                                        self.event.reject('checkdb');
                                    } else {
                                        self.event.fire('init');
                                    }
                                    return self.event.promise('checkdb');
                                }).follow().fail(function(){
                                    return self.db.clear();
                                }).follow().then(function(){
                                    var fn = arguments.callee,
                                        obj = opt.defaultDB.pop();
                                    if (obj) {
                                        self.db.put(obj, fn);
                                    } else {
                                        self.event.fire('init');
                                    }
                                });
                            }
                        } 
                    });
                } catch (ex) {
                    this.alert('你的浏览器不支持IndexedDB！去死罢！');
                    return;
                }
                var canvas = this.canvas = opt.canvas;
                canvas.mousemove(function(e){
                    if (e.target.className == "card" && e.target.nodeName === "A") {
                        canvas[0].appendChild(e.target);
                    }
                });
                this.textFaceUp = true;
                return this.event.promise('init');
            },

            clear: function(){
                var self = this;
                return self.db.clear(function(){
                    self.canvas[0].innerHTML = '';
                });
            },

            //checkin: function(text){
                //if (!/\S/.test(text)) {
                    //this.alert("称呼不能为空");
                    //return;
                //}
                //text = tpl.substr(text, 22);
                //var data = { uid: uuid++, name: text };
                //this.db.push(data);
                //this.draw(data);
            //},

            draw: function(data){
                if (!data || !data.name || data.reward) {
                    return;
                }
                var pos = positionRandom(random_opt);
                var angle = 30 * M.random() - 15;
                var tplData = {
                    uid: data.uid,
                    title: tpl.escapeHTML(data.name),
                    x: pos[0],
                    y: pos[1],
                    rotate: angle 
                };
                this.canvas.append(tpl.format(TPL_CARD, tplData));
            },

            shuffle: function(){
                var self = this;
                this.canvas[0].innerHTML = '';
                this.db.getAll(function(rows){
                    rows.sort(function(){
                        return M.random() - 0.5;
                    }).forEach(function(data){
                        self.draw(data);
                    }, this);
                });
            },

            turnover: function(){
                this.textFaceUp = !this.textFaceUp;
                if (this.textFaceUp) {
                    this.canvas.removeClass("textDown");
                } else {
                    this.canvas.addClass("textDown");
                }
            },

            alert: function(msg, cb, opt){
                opt = opt || {};
                msg = msg || "操作失败";
                var dlg = this.dialog;
                var buttons = [];
                if (cb) {
                    buttons.push({
                        text: "确定",
                        method: function(){
                            cb();
                            dlg.close();
                        }
                    }, "cancel");
                } else {
                    if (!opt.hideButton) {
                        buttons.push("confirm");
                    }
                }
                dlg.set({
                    title: opt.title || "提示",
                    content: '<div class="alert-dlg">' + msg + '</div>',
                    width: 700,
                    buttons: buttons
                }).open();
            },

            pick: function(uid, reward){
                var self = this;
                this.db.get(uid, function(data){
                    data.reward = reward;
                    self.db.put(data);
                });
            },

            unpick: function(uid){
                var self = this;
                this.db.get(uid, function(data){
                    delete data.reward;
                    self.db.put(data);
                    self.draw(data);
                });
            },

            export: function(cb){
                this.db.getAll(function(rows){
                    var lists = {};
                    rows.forEach(function(data){
                        var reward = data.reward;
                        if (reward) {
                            if (!lists[reward]) {
                                lists[reward] = [];
                            }
                            lists[reward].push(data);
                        }
                    }, this);
                    cb(lists);
                });
            }

        };

    function rand(max){
        return M.floor(M.random() * max);
    }

    function positionRandom(opt, n, z){
        n = n || 0;
        z = z || 0;
        var x = M.floor(M.random() * (opt.spaceWidth - opt.width)),
            y = M.floor(M.random() * (opt.spaceHeight - opt.height)),
            record = opt.record[z];

        if (!record) {
            record = opt.record[z] = [];
        }
        for (var i = 0, o, l = record.length; i < l; i++) {
            o = record[i];
            if ((x >= o[0] - opt.width && x <= o[0] + opt.width)
                && (y >= o[1] - opt.height && y <= o[1] + opt.height)) {

                if (n > (opt.disperseLevel || 5)) {
                    n = 0;
                    z++;
                }
                return positionRandom(opt, ++n, z);
            }
        }

        var result = [x, y, z];
        record.push(result);
        return result;
    }

    return luckybox; 

});
