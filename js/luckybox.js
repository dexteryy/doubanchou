
define([
    "lib/jquery",
    "mod/lang",
    "mod/browsers",
    "mod/event",
    "mod/template",
    "mod/db",
    "mod/dialog"
], function($, _, browsers, Event, tpl, db, Dialog){

    var M = Math,
        BOX_W = 740,
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
                + TRANSFORM_ORIGIN_STYLE + ':50% 50%;' 
                + TRANSFORM_STYLE + ':rotate({{rotate}}deg);"><span class="card">{{title}}</span></a>',

        random_opt = {
            width: CARD_WIDTH + 5,
            height: CARD_HEIGHT + 5,
            spaceWidth: BOX_W,
            spaceHeight: BOX_H,
            record: [] 
        },

        uuid = 1,

        teamLib = {};

    var luckybox = {

        init: function(opt){
            var self = this;
            this.event = Event();
            this.round = 0;
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

            db.open({
                server: 'luckyboxDB12',
                version: 1,
                schema: {
                    cards: {
                        key: { keyPath: 'uid' , autoIncrement: true }
                    }
                }
            }).done(function (server){
                self.db = server.cards;
                self.db.query().all().execute().done(function(rows){
                    if (opt.reset && rows.length) {
                        return self.event.promise('checkdb').reject([rows]);
                    }
                    if (!rows.length) {
                        return true;
                    } else {
                        rows.forEach(function(obj){
                            this.setTeam(obj);
                        }, self);
                        self.event.resolve('init');
                    }
                }).follow().then(function(){
                    return true;
                }, function(rows){
                    return Event.when.apply(Event, rows.map(function(obj){
                        return self.db.remove(obj.uid);
                    }));
                }).follow().then(function(){
                    var obj = opt.defaultDB.pop();
                    if (obj) {
                        self.db.add(obj).then(arguments.callee);
                        self.setTeam(obj);
                    } else {
                        self.event.resolve('init');
                    }
                });
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

        setTeam: function(obj){
            if (obj._team) {
                var team = teamLib[obj._team];
                if (!team) {
                    team = teamLib[obj._team] = { 
                        name: obj._team, 
                        members: [], 
                        dict: {},
                        rounds: {},
                        count: 0
                    };
                }
                if (obj.uid) {
                    if (!team.dict[obj.uid]) {
                        team.members.push(obj);
                        team.dict[obj.uid] = obj;
                        team.rounds[obj._round] = obj;
                        if (obj._round > this.round) {
                            this.round = obj._round;
                        }
                        team.count++;
                    } else {
                        _.mix(team.dict[obj.uid], obj);
                    }
                }
            } else if (obj._ex_team){
                var ex_team = teamLib[obj._ex_team];
                delete ex_team.dict[obj.uid];
                delete ex_team.rounds[obj._round];
                var index = -1;
                ex_team.members.forEach(function(p, i){
                    if (p.uid == obj.uid) {
                        index = i;
                    }
                });
                if (index > 0) {
                    ex_team.members.splice(index, 1);
                }
                ex_team.count--;
            }
        },

        getTeam: function(name){
            return teamLib[name];
        },

        getTeams: function(){
            return Object.keys(teamLib).map(function(name){
                return this[name];
            }, teamLib);
        },

        clear: function(){
            var self = this;
            return self.db.clear().then(function(){
                self.canvas[0].innerHTML = '';
            });
        },

        draw: function(data, opt){
            if (!data || !data.name || data._team) {
                return;
            }
            var pos = opt && opt.pos || positionRandom(random_opt);
            var angle = 30 * M.random() - 15;
            var tplData = {
                uid: data.uid,
                title: tpl.escapeHTML(data.name),
                x: pos[0],
                y: pos[1],
                rotate: angle 
            };
            return $(tpl.format(TPL_CARD, tplData)).appendTo(this.canvas);
        },

        shuffle: function(){
            var self = this;
            this.canvas[0].innerHTML = '';
            this.db.query().all().execute().then(function(rows){
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
                isHideTitle: opt.isHideTitle || false,
                title: opt.title || "提示",
                content: '<div class="alert-dlg">' + msg + '</div>',
                width: opt.width || 400,
                buttons: buttons
            }).open();
        },

        pick: function(uid, chosen, cb){
            var self = this;
            this.db.get(parseInt(uid)).then(function(data){
                data._team = chosen;
                data._round = ++self.round;
                self.db.update(data);
                self.setTeam(data);
                if (cb) {
                    cb(data);
                }
            });
        },

        unpick: function(uid, cb){
            var self = this;
            this.db.get(parseInt(uid)).then(function(data){
                data._ex_team = data._team;
                delete data._team;
                self.setTeam(data);
                delete data._ex_team;
                self.db.update(data);
                self.draw(data);
                if (cb) {
                    cb(data);
                }
            });
        },

        exportData: function(cb){
            this.db.query().all().execute().then(function(rows){
                var lists = {};
                rows.forEach(function(data){
                    var chosen = data._team;
                    if (chosen) {
                        if (!lists[chosen]) {
                            lists[chosen] = [];
                        }
                        lists[chosen].push(data);
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
