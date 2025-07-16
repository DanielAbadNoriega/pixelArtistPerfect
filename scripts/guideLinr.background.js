(function( scope ) {
    "use strict";

    var store = 'localStorage' in window && window['localStorage'] !== null ? window.localStorage : {};

    // if no option has been set, turn it on.
    if ( !store.doContextMenu )
        store.doContextMenu = 'true';

    if ( !store.showDistances )
        store.showDistances = 'true';

    scope.contextMenu = {
        sendMessage: function( method ) {
            chrome.tabs.getSelected( null, function(tab) {
                console.log( 'Create guide(s): ' + method, tab );

                chrome.tabs.sendMessage( tab.id, {
                    method: 'contextmenu' + method
                    , color: store.selectedColor
                }, function( response ) {
                });            
            });
        }
        , entries: {
            addvert: 'Create Vertical Guide'
            , addhorz: 'Create Horizontal Guide'
            , surround: 'Element: All Sides'
            , top: 'Element Top'
            , right: 'Element Right'
            , bottom: 'Element Bottom'
            , left: 'Element Left'
        }
        , deactivate: function() {
            if ( this._ids && this._ids.length )
                for ( var i = 0, len = this._ids.length; i < len; i++ ) {
                    try {
                        console.log('Removed contextMenu entry');
                        chrome.contextMenus.remove( this._ids[i] );
                    } catch(er) {
                        console.log('Error removing menu item', er);
                    }
                }
            delete this._ids;
        }
        , activate: function() {
            this.deactivate();
            
            this._ids = [];
            for ( var key in this.entries ) {
                this._ids.push(
                    chrome.contextMenus.create({
                        'title': this.entries[key]
                        , 'contexts': [ 'all' ]
                        , 'onclick': (function(scope, key) {
                            return function( ev) {
                                scope.sendMessage(key);
                            }
                        })(this, key)
                    })
                );
            }
            return this;
        }
    };

    var getPageDb = function( url ) {
            return ({
                store: store
                , init: function( url ) {
                    if ( !url )
                        throw new Error('Unable to init storage without a url');

                    console.log( 'DB :: opening storage for url: ', url );

                    this.url = url;
                    this.allGuides = this.store.guides ? JSON.parse(this.store.guides) : {};
                    this.myGuides = this.allGuides[this.url] || {};

                    console.log( 'DB :: my guides: ', this.myGuides );

                    return this;
                }
                , get: function() {
                    return this.myGuides;
                }
                , save: function( data ) {
                    this.myGuides[data.id] = data;

                    console.log( 'DB :: new array after saving: ', this.myGuides );

                    this.commit();

                    return this;
                }
                , clear: function() {
                    this.myGuides = {};
                    this.commit();
                    return this;
                }
                , remove: function( guideId ) {
                    if ( this.myGuides[guideId] ) {
                        console.log( 'DB :: removing id: ', guideId );
                        delete this.myGuides[guideId];
                        this.commit();
                        return true;
                    }
                    return false;
                }
                , commit: function() {
                    this.allGuides[this.url] = this.myGuides;
                    this.store.guides = JSON.stringify( this.allGuides );
                    console.log( 'DB :: committed' );
                    return this;
                }
                
                , getKey: function( key ) {
                    return this.store[key];
                }
            }).init( url );
        };

    // METHODS TAKEN FROM:
    // http://stackoverflow.com/questions/3937000/chrome-extension-accessing-localstorage-in-content-script


    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if ( changeInfo.status == "complete" ) {
            console.log( 'onUpdated status = "complete"', tab.url );
            var url = tab.url.replace(/\#.*/, '')
                , db = getPageDb(url)
                , guides = db.get();

            chrome.tabs.sendMessage( tabId, {
                method: "injectGuide"
                , guides: guides
            }, function( response ) {
                console.log('about to set showDistances? ', db.getKey('showDistances') );
                if ( db.getKey('showDistances') == 'true' )
                    chrome.tabs.sendMessage( tabId, {
                        method: 'activateDistances'
                    });
                if ( db.getKey('doContextMenu') == 'true' ) {
                    chrome.tabs.sendMessage( tabId, {
                        method: 'activateContextMenu'
                    });
                    scope.contextMenu.activate();
                }
                    

                chrome.tabs.sendMessage( tabId, {
                    method: 'setSnapToPx'
                    , snapToPx: db.getKey('snapToPx')
                });
                chrome.tabs.sendMessage( tabId, {
                    method: 'setSnapToEls'
                    , snapToEls: db.getKey('snapToEls')
                });

            });
        }
    });

    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
        console.log( 'REQUEST RECEIVED (background): ', request );

        // EVERYTHING BELOW HERE IS FOR PERSISTING GUIDES
        if ( !request.url )
            return sendResponse({});
        request.url = request.url.replace(/\#.*/, '');
        var db = getPageDb( request.url );

        if ( request.method == 'saveGuide' ) {
            sendResponse({
                id: db.save( request.guideData )
            });

        } else if ( request.method == 'removeGuide' ) {
            sendResponse({
                success: db.remove(request.id)
            });

        } else if ( request.method == 'clearGuides' ) {
            db.clear();
            sendResponse({});

        } else
            sendResponse({}); // snub them.
    });
})(this);