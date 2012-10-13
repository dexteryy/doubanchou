require.config({
    baseUrl: 'js/',
    distUrl: 'dist/js/'
});

define("jquery-src", "lib/jquery.js");
define("lib/jquery.mousewheel", ["jquery-src"]);
define("lib/jquery", ["mod/easing", "jquery-src", "lib/jquery.mousewheel"], function(elib){
    var $ = jQuery;
    $.easing['jswing'] = $.easing['swing'];
    $.extend($.easing, elib.functions);
    return $;
});

define("data/draft", "../data/draft.json");

require([
    "lib/jquery", 
    "mod/lang", 
    "mod/uiproxy", 
    "mod/template", 
    "luckybox", 
    "data/draft", 
    "mod/domready"
], function($, _, uiproxy, tpl, app, json){

    var data = json.list.map(function(str){
        var info = {};
        str.split(/,\s*/).forEach(function(text, i){
            info[this[i]] = text;
        }, json.fields);
        return info;
    });

    app.init({
        canvas: $('#luckybox'),
        defaultDB: data
    }).then(function(){
        app.shuffle();
    });

    var current_team = '';
    var count = 0;
    var pickbox = $('#pickbox');
    var pickcount = $("#pickcount strong");
    var teamlist = $('#teamlist');

    app.event.bind('init', function(){
        updateTeamlist();
    });

    uiproxy.add(document.body, 'click', {
        ".shuffle-btn": function(){
            app.shuffle();
        },
        ".turnover-btn": function(){
            app.turnover();
        },
        ".new-btn": function(){
            app.alert('<input type="text" id="teamName" value="" placeholder="名称" />', function(){
                var newteam = $('#teamName')[0].value;
                app.setTeam({ _team: newteam });
                switchTeam(newteam);
            }, {
                title: '请输入名称'
            });
        },
        ".show-btn": function(){
            app.alert(tpl.convertTpl('tplTeamInfo', {
                teams: app.getTeams(),
                round: app.round
            }), false, {
                width: 760,
                hideButton: true,
                isHideTitle: true
            });
        },
        ".export-btn": function(){
            app.exportData(function(lists){
                app.alert(tpl.convertTpl('tplExport', { lists: lists }), {
                    title: '导出数据'
                });
            });
        },
        ".reset-btn": function(){
            app.clear().then(function(){
                location.reload();
            });
        },
        ".team": clickTeam,
        ".team.chosen": clickTeam,
        ".card": function(){
            if (this.nodeName !== "A") {
                return arguments.callee.call(this.parentNode);
            }
            var me = $(this);
            var cid = (/#uid=(\w+)/.exec(me.attr("href")) || [])[1];
            if (cid) {
                if (me.data('chosen')) {
                    app.unpick(cid, function(){
                        me.remove();
                        updateTeamlist();
                        pickcount[0].innerHTML = --count;
                    });
                } else {
                    if (!current_team) {
                        app.alert('请先创建或选择一个集合');
                        return;
                    }
                    app.pick(cid, current_team, function(data){
                        app.dialog.set({
                            isHideTitle: true,
                            content: tpl.convertTpl('tplDetail', { info: data, fields: json.fields_title }),
                            width: 700
                        }).open();
                        app.dialog.event.wait('close', function(){
                            updateTeamlist();
                            pickCard(me);
                            pickcount[0].innerHTML = ++count;
                        });
                    });
                }
            }
        }
    });

    function clickTeam(){
        var myteam = this.href.replace(/.*#/, '');
        app.alert(tpl.convertTpl('tplTeamInfo', {
            teams: app.getTeams().filter(function(team){
                if (team.name === myteam) {
                    return true;
                }
            }),
            round: app.round
        }), function(){
            switchTeam(myteam);
        }, {
            width: 500,
            isHideTitle: true
        });
    }

    function pickCard(card){
        var pos = card.offset();
        var newpos = card.css('visibility', 'hidden').appendTo(pickbox).offset();
        card.clone().appendTo('body').css(pos).css('visibility', 'visible').animate(newpos, 500, 'easeInOutQuad', function(){
            $(this).remove();
            card.css('visibility', 'visible').data('chosen', current_team);
        });
    }

    function switchTeam(team){
        if (current_team == team) {
            return;
        }
        current_team = team;
        updateTeamlist();
        pickbox[0].innerHTML = '';
        var pos = teamlist.offset();
        app.getTeam(team).members.forEach(function(obj){
            delete obj._team;
            var card = app.draw(obj, {
                pos: [pos.left, pos.top]
            });
            obj._team = team;
            pickCard(card);
        });
    }

    function updateTeamlist(){
        teamlist[0].innerHTML = tpl.convertTpl('tplTeamlist', {
            current_team: current_team,
            teams: app.getTeams()
        });
    }

});
