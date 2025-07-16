(function() {

    var log = function() {
        return; // comment to allow logging!

        var args = Array.prototype.slice.call( arguments, 0 );
        args.unshift( 'guideLinr :: ' );
        return console.log.apply( console, args );
    };

    var colors = [
        'lime'
        , 'aqua'
        , 'blue'
        , 'green'
        , 'yellow'
        , 'orange'
        , 'red'
        , 'pink'
    ];

    var lines = ({
        register: function( line ) {
            if ( !this.list  )
                this.list = {};
            this.list[line._id] = line;
            log( 'lines.register()', line._id, this.list );
        }
        , remove: function( line ) {
            if ( this.list )
                delete this.list[line._id];
            log( 'lines.remove()', line._id, this.list );
        }
        , withAll: function( callback ) {
            if ( this.list )
                for ( var id in this.list ) {
                    //var ret = callback( this.list[id] );
                    //if ( typeof(ret) != 'undefined' )
                    //    return ret;
                    callback( this.list[id] ); // this is simpler (and faster), so if you don't need the above cool complexity, leave it out
                }
            //log( 'lines.withAll() :: DONE', this.list ); // too aggressive!
        }

        , _snap: 0
        , setSnap: function( snap ) {
            return (this._snap = parseInt(snap, 10) || 0);
        }
        , getSnap: function() {
            return this._snap;
        }
        
        , _snapEls: 0
        , setSnapEls: function( snap ) {
            return (this._snapEls = parseInt(snap, 10) || 0);
        }
        , getSnapEls: function() {
            return this._snapEls;
        }

        , resize: function() {
            var hasDist = distances.isActive()
            distances.deactivate();
            this.withAll(function( guide ) {
                guide._.css({ // so no guide affects the width of the document while resizing
                    height: '0'
                    , width: '0'
                });
            });
            var win = $(window)
                , doc = $(document)
                , docH = doc.height()
                , docW = doc.width()
                , winH = win.height()
                , winW = win.width();
            this.withAll(function( guide ) {
                guide.resizeRoutine( docH, docW, winH, winW );
            });
            if ( hasDist )
                distances.activate();
        }

        , init: function() {

            this._winResize = function() {
                clearTimeout( this._resizeTimer );
                this._resizeTimer = setTimeout( this.resize.bind(this), 5 );
            }.bind(this);
            $(window).on( 'resize', this._winResize )

            return this;
        }
    }).init();

    var line = function( options ) {
        this.win = $(window);
        this.doc = $(document);
        this.body = $(document.body);

        this._dir = options.dir == 'horz' ? 'horz' : 'vert';
        this._id = options.id
                    || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                        return v.toString(16);
                    });
        this._color = options.color;

        //log( 'options: ', options );

        this._ = $('<div>')
                    .addClass( [ 'guideLinr-line', this._dir, options.color ].join(' ') )
                    .attr( 'tabIndex', '0' ) // so it can receive keyboard focus
                    .on( 'mousedown', this.dragMouseDown.bind(this) )
                    .on( 'mousemove', this.dialogMouseMove.bind(this) )
                    .on( 'mouseout', this.dialogMouseOut.bind(this) )
                    .on( 'contextmenu', this.dialogContextMenu.bind(this) )
                    .on( 'keydown', this.keyDown.bind(this) )
                    .appendTo( document.body )
                    .fadeIn('fast');

        this.resizeRoutineHeavy();

        var snap = lines.getSnap();
        if ( options.pos )
            this.setPosition( options.pos ); // don't snap this one if it was set before snapping was on
        else if ( snap ) {
            this.snapToNextEmptyPosition( snap );
        } else
            this.snapPosition(
                this._dir == 'vert'
                    ? ( this.win.width() / 2 ) + this.win.scrollLeft()
                    : ( this.win.height() / 2 ) + this.win.scrollTop()
            );

        this._dragging = false;

        // scope-bound handlers
        this._dragMouseMove = this.dragMouseMove.bind(this);
        this._dragMouseUp = this.dragMouseUp.bind(this);

        lines.register( this );

        if ( !options.id ) // no need to save update if this was loaded from previous save
            this.save();
    };
    line.prototype = {
        save: function() {
            chrome.extension.sendRequest(
                {
                    method: "saveGuide"
                    , url: location.href
                    , guideData: {
                        color: this._color
                        , dir: this._dir
                        , pos: this.getPosition()
                        , id: this._id
                    }
                }
            );
        }
        
        , focusTo: function() {
            this._.focus();
        }

        , resizeRoutineHeavy: function() {
            return this.resizeRoutine( this.doc.height(), this.doc.width(), this.win.height(), this.win.width() ); // sets _thickOffset used in setting position
        }
        , resizeRoutine: function( docHeight, docWidth, winHeight, winWidth ) {
            if ( this._dir == 'vert' ) {
                this._.css({
                    top: '0'
                    , height: ( Math.max( docHeight, winHeight ) - 2 ) + 'px'
                    , width: ''
                });
                this._thickOffset = Math.round( this._.width() / 2 );
            } else {
                this._.css({
                    left: '0'
                    , height: ''
                    , width: ( Math.max( docWidth, winWidth ) - 2 ) + 'px'
                });
                this._thickOffset = Math.round( this._.height() / 2 );
            }
        }

        , snapPosition: function( n ) {
            var snap = lines.getSnap()
                , snapDist = ( snap ? n % snap : 0 );
            if ( snap && snapDist > ( snap / 2 ) ) // so it will snap forward as well as back
                snapDist = 0 - ( snap - snapDist );
            if ( snap ) // gotta put the middle of the element on the snapped pixel, so remove half (thickOffset)
                snapDist += this._thickOffset;
            return this.setPosition( n - snapDist );
        }
        , setPosition: function( n ) {
            n = Math.floor(n);

            this._pos = n;
        
            this._.css( this._dir == 'vert' ? 'left' : 'top', n + 'px' );
            this._.css( this._dir == 'vert' ? 'top' : 'left', '0' );
        
            this.save();
            this.fireMovedEvent();
        
            return this;
        }
        , getPosition: function() {
            return this._pos;
        }
        , fireMovedEvent: function() {
            return this.body.trigger('guideLinrMoved');
        }
        
        , snapToNextEmptyPosition: function( snap ) {
            var current = snap
                , guides = []
                , guideAtCurrent = false;
            lines.withAll(function( guide ) {
                if ( guide._dir == this._dir )
                    guides.push( guide );
            }.bind(this));
            do {
                guideAtCurrent = false;
                for ( var i = 0, ilen = guides.length; i < ilen; i++ ) {
                    if ( guides[i].getPosition() + guides[i]._thickOffset == current )
                        guideAtCurrent = guides[i];
                }
            } while( guideAtCurrent && (current += snap) );
            this.snapPosition( current );
        }

        , dialogMouseMove: function(ev) {
            clearTimeout( this._dialogTimer );
            this._dialogTimer = setTimeout(function() {
                if ( !this._dialog && !this._dragging )
                    this._dialog = new dialog( this, ev );
            }.bind(this), 500);
        }
        , dialogMouseOut: function(ev) {
            clearTimeout( this._dialogTimer );
        }
        , dialogContextMenu: function(ev) {
            if ( !this._dialog ) { // if right click
                ev.preventDefault();
                this._dialog = new dialog( this, ev );
            }
        }

        , dragMouseDown: function(ev) {
            ev.preventDefault();
            ev.stopPropagation();

            this.focusTo();

            var lineOffset = this._.offset();
            this._offset = {
                pageX: ev.pageX - lineOffset.left
                , pageY: ev.pageY - lineOffset.top
            };
            $(document.body)
                .on( 'mousemove', this._dragMouseMove )
                .on( 'mouseup', this._dragMouseUp )
                .css( 'cursor', this._dir == 'vert' ? 'e-resize' : 'n-resize' );

            if ( this._dialog )
                this._dialog.destroy();

            this._dragging = true;
        }

        , getSnapElement: function( ev, offset ) {
            this._.hide();
            var snapElement = $(document.elementFromPoint(
                ( ev.pageX - this.win.scrollLeft() ) + ( this._dir == 'vert' ? offset : 0 )
                , ( ev.pageY - this.win.scrollTop() ) + ( this._dir == 'vert' ? 0 : offset )
            ));
            this._.show();
            return snapElement;
        }
        , setHoverOutline: function( el ) {
            if ( this.__prevHoverOutline && this.__prevHoverOutline[0] == el[0] )
                return;
            log('Drawing a hover outline', el );
            this.clearHoverOutline();
            this.__prevHoverOutline = el;
            contextMenu.showOutline( el );
        }
        , clearHoverOutline: function() {
            delete this.__prevHoverOutline;
            contextMenu.hideOutline();
        }

        , dragMouseMove: function( ev ) {
            ev.preventDefault();

            var offset = this._offset || { pageX: 0, pageY: 0 }
                , newValue = this._dir == 'vert'
                                ? ( ev.pageX - offset.pageX )
                                : ( ev.pageY - offset.pageY );

            var snapDistance = lines.getSnapEls();
            if ( snapDistance ) {
                var snapElement = this.getSnapElement( ev, 0 );
                if ( snapElement.length ) {
                    this.setHoverOutline( snapElement );
                
                    var elementOffset = snapElement.offset()
                        , elementCoord = this._dir == 'vert' ? 'left' : 'top'
                        , topLeft = elementOffset[elementCoord] - this._thickOffset
                        , topLeftDiff = Math.max( newValue, topLeft ) - Math.min( newValue, topLeft );
                    if ( topLeftDiff <= snapDistance )
                        newValue = topLeft;
                    else { // snap to bottom/right
                        var elementDim = this._dir == 'vert' ? 'outerWidth' : 'outerHeight'
                            , rightBottom = topLeft + snapElement[elementDim]()
                            , rightBottomDiff = Math.max( newValue, rightBottom ) - Math.min( newValue, rightBottom );
                        if ( rightBottomDiff <= snapDistance )
                            newValue = rightBottom;
                    }
                }
            }
            this.snapPosition( newValue );
        }
        , dragMouseUp: function( ev ) {
            ev.preventDefault();
            ev.stopPropagation();

            $(document.body)
                .off( 'mousemove', this._dragMouseMove )
                .off( 'mouseup', this._dragMouseUp )
                .css( 'cursor', '' );

            this.clearHoverOutline();

            this._dragging = false;
            delete this._offset;

            this.save();

            this.fireMovedEvent();
        }
        , keyDown: function( ev ) {
            if ( ev.keyCode < 37 || ev.keyCode > 40 ) {
                return; // not arrow key, so return;
            }
            ev.preventDefault();
            ev.stopPropagation();

            var snap = lines.getSnap()
                , inc = snap || ( ev.shiftKey ? 10 : 1 )
                , diff = 0;
            if ( this._dir == 'vert' ) {
                switch ( ev.keyCode ) {
                    case 37: diff -= inc; break; // left
                    case 39: diff += inc; break; // right
                }
            } else {
                switch ( ev.keyCode ) {
                    case 38: diff -= inc; break; // up
                    case 40: diff += inc; break; // down
                }
            }

            if ( diff ) {
                this.snapPosition(
                    this.getPosition()
                    + diff
                    + ( snap ? this._thickOffset : 0 ) // if snapping, this will be removed in the snapPosition method, so it must be added here for small grid sizes
                );
                if ( this._dialog )
                    this._dialog.destroy();
            }
        }

        , destroy: function() {

            chrome.extension.sendRequest(
                {
                    method: "removeGuide"
                    , url: location.href
                    , id: this._id
                }
                , function(response) {
                    if ( !response.success )
                        alert('Really sorry, but there was a problem saving something.  This line might show back up');
                }
            );

            lines.remove( this );

            $(document.body)
                .off( 'mousemove', this._dragMouseMove )
                .off( 'mouseup', this._dragMouseUp );
            delete this.win;
            delete this.doc;
            this._.off().fadeOut( 'fast', function() {
                this._.remove();
                this.fireMovedEvent();
            }.bind(this));
        }
    };

    var dialog = function( line, mouseEvent ) {
        if ( line._dialog )
            return; // this line already has a dialog!

        this.line = line;
        this.icons = {};
        this._ = $('<div>')
                    .addClass('guideLinr-dialog ' + line._dir)
                    .append(
                        (this.icons.del = this.createIcon('delete', 'Remove Guide'))
                        , (this.icons.rot = this.createIcon('rotate', 'Rotate Guide'))
                        , (this.icons.color = this.createIcon('color', 'Change Color'))
                    )
                    .appendTo( document.body );

        if ( this.line._dir == 'vert' ) {
            this._.css({
                //left: ( mouseEvent.pageX - Math.floor( this._.width() / 2 ) ) + 'px'
                left: Math.floor( ( this.line._thickOffset - (this._.width() / 2) ) + this.line.getPosition() ) + 'px'
                , top: ( mouseEvent.pageY + 10 ) + 'px'
            });
        } else {
            this._.css({
                left: ( mouseEvent.pageX + 10 ) + 'px'
                , top: Math.floor( ( this.line._thickOffset - (this._.height() / 2) ) + this.line.getPosition() ) + 'px'
                //, top: ( mouseEvent.pageY - Math.floor( this._.height() / 2 ) ) + 'px'
            });
        }

        this._mouseOut = this.mouseOut.bind(this);
        this._mouseOver = this.mouseOver.bind(this);

        this._
            .on( 'mouseout', this._mouseOut )
            .on( 'mouseover', this._mouseOver );
        this.line._
            .addClass('glow')
            .on( 'mouseout', this._mouseOut )
            .on( 'mouseover', this._mouseOver );

        this.icons.del.on( 'click', function() {
            this.line.destroy();
            this.destroy();
        }.bind(this));

        this.icons.rot.on( 'click', function( ev ) {
            this.destroy();
            var goingVert = this.line._dir == 'horz';
            this.line._dir = goingVert ? 'vert' : 'horz';
            this.line._
                .removeClass( goingVert ? 'horz' : 'vert' )
                .addClass( goingVert ? 'vert' : 'horz' );
            this.line.resizeRoutineHeavy();
            this.line.dragMouseMove( ev );
        }.bind(this));

        this.icons.color.on( 'click', this.clickColor.bind(this) );

        this._.on( 'click', 'i', function(ev) {
            setTimeout( function() {
                this.line.focusTo(); // so keyboard events will still work after orientation switch
            }.bind(this), 0 );
        }.bind(this));
    }
    dialog.prototype = {
        mouseOut: function() {
            this._timer = setTimeout( this.destroy.bind(this), 500 );
        }
        , mouseOver: function() {
            clearTimeout( this._timer );
        }
        , destroy: function() {
            this._
                .off( 'mouseout', this._mouseOut )
                .off( 'mouseover', this._mouseOver )
                .fadeOut( 'fast', function() {
                    $(this).remove();
                });
            this.line._
                .removeClass('glow')
                .off( 'mouseout', this._mouseOut )
                .off( 'mouseover', this._mouseOver );
            delete this.line._dialog;
        }

        , createIcon: function( addOnClass, title ) {
            var icon = $('<i>').text(' ').addClass('guideLinr-icon ' + addOnClass);
            if ( title )
                icon.attr('title', title);
            return icon;
        }

        , clickColor: function() {
            this._.find('i').remove();;
            for ( var i = 0, len = colors.length; i < len; i++ ) {
                this.createIcon(colors[i])
                    .appendTo( this._ )
                    .data('color', colors[i])
                    .on( 'click', function( ev ) {
                        var newColor = $(ev.target).data('color');
                        this.line._
                            .removeClass( colors.join(' ') )
                            .addClass( newColor )
                        this.line._color = newColor;
                        this.line.save();
                        this.line.fireMovedEvent();
                    }.bind(this) );
            }
        }
    };


    var distances = {
        timer: null
        , debouncedDraw: function( ev ) {
            clearTimeout( this.timer );
            this.timer = setTimeout( this.draw.bind(this), 5 ); // because some events happen near simultaneously
        }
        , swapIndices: function( array, ind1, ind2 ) {
            array[ind1] = array.splice( ind2, 1, array[ind1] )[0];
            return array;
        }
        , bubbleSort: function( array ) {
            var swapped;
            do {
                swapped = false;
                for ( var i = 0, ilen = array.length-1; i < ilen; i++ ) {
                    if ( array[i].getPosition() > array[i+1].getPosition() ) {
                        this.swapIndices( array, i, i+1 );
                        swapped = true;
                    }
                }
            } while (swapped);
            return array;
        }
        , limitArrayToColor: function( color, arr ) {
            var returnArr = [];
            for ( var i = 0, len = arr.length; i < len; i++ ) {
                if ( arr[i]._color == color )
                    returnArr.push( arr[i] );
            }
            return returnArr;
        }

        , removeAll: function() {
            if ( this.cache ) {
                $.each( this.cache, function(i, dist) {
                    dist.remove();
                });
                delete this.cache;
            }
            this.cache = [];
        }

        , draw: function() {
            this.removeAll();

            var ordered = { horz: [], vert: [] };
            lines.withAll(function( guide ) {
                ordered[guide._dir].push( guide );
            });

            ordered.horz = this.bubbleSort( ordered.horz );
            ordered.vert = this.bubbleSort( ordered.vert );
            //log('draw with these? ', ordered );

            var top = 0
                , left = 0
                , doc = $(document)
                , docWidth = doc.width()
                , docHeight = doc.height()
                , win = $(window)
                , scrollTop = win.scrollTop()
                , scrollLeft = win.scrollLeft()
                , vertWidth = ordered.vert && ordered.vert[0] ? ordered.vert[0]._thickOffset : 0
                , horzHeight = ordered.horz && ordered.horz[0] ? ordered.horz[0]._thickOffset : 0;

            for ( var c = 0, clen = colors.length; c < clen; c++ ) {
                var color = colors[c]
                    , guides = this.limitArrayToColor( color, ordered.vert );
                if ( guides.length ) { // if there are any guides this color...
                    for ( var i = -1, ilen = guides.length; i < ilen; i++ ) {
                        var pos1 = guides[i+1] ? guides[i+1].getPosition() : docWidth
                            , pos2 = guides[i] ? guides[i].getPosition() : 0
                            , offset = guides[i] ? vertWidth : 0
                            , wid = ( pos1 - pos2 )
                                    + ( !guides[i] ? vertWidth : 0 ) // for the one on the leftmost
                                    - ( !guides[i+1] ? vertWidth : 0 ); // for the one on the rightmost
                        var dist = $('<div>')
                            .addClass('guideLinr-distance ' + color)
                            .text( wid + 'px' )
                            .attr( 'title', wid + 'px' )
                            .css({
                                left: ( ( pos2 + offset ) - scrollLeft ) + 'px'
                                , top: top + 'px'
                                , width: wid + 'px'
                            })
                            .appendTo( document.body );
                        this.cache.push( dist );
                    }
                    top += dist.height();
                }

                var guides = this.limitArrayToColor( color, ordered.horz );
                if ( guides.length ) { // if there are any guides this color...
                    for ( var i = -1, ilen = guides.length; i < ilen; i++ ) {
                        var pos1 = guides[i+1] ? guides[i+1].getPosition() : docHeight
                            , pos2 = guides[i] ? guides[i].getPosition() : 0
                            , offset = guides[i] ? horzHeight : 0
                            , hei = ( pos1 - pos2 )
                                    + ( !guides[i] ? horzHeight : 0 ) // for the one at the very top
                                    - ( !guides[i+1] ? horzHeight : 0 ); // for the one at the very bottom
                        var dist = $('<div>')
                            .addClass('guideLinr-distance horz ' + color)
                            .css({
                                top: ( ( pos2 + offset ) - scrollTop ) + 'px'
                                , left: left + 'px'
                                , height: hei + 'px'
                            })
                            .attr( 'title', hei + 'px' )
                            .append(
                                $('<span>')
                                    .text(hei + 'px')
                                    .css({
                                        top: Math.floor(hei/2) + 'px'
                                    })
                            )
                            .appendTo( document.body );
                        this.cache.push( dist );
                    }
                    left += dist.width();
                }
            }

        }

        , isActive: function() {
            return this._debouncedDraw ? true : false;
        }
        , activate: function() {
            log('Activating distances');
            this.deactivate();
            this._debouncedDraw = this.debouncedDraw.bind(this);
            $(document.body).on( 'guideLinrMoved.guideLinr', this._debouncedDraw );
            $(window).on( 'scroll', this._debouncedDraw );
            this.draw();
        }
        , deactivate: function() {
            log('Deactivating distances');
            $(document.body)
                .off( 'guideLinrMoved.guideLinr', this._debouncedDraw )
                .off('.guideLinr');
            $(window).off( 'scroll', this._debouncedDraw );
            this.removeAll();
            delete this._debouncedDraw;
        }
    };

    var createGuides = function( options ) {
        for ( var k in options ) {
            log( 'Inserting guide: ', options[k] );
            new line( options[k] );
        }
    };

    var contextMenu = ({
        thickOffset: 4
        , init: function() {
            this._onContextMenu = this.onContextMenu.bind(this);
            this._clearDataAndHide = this.clearDataAndHide.bind(this);
            this._hideOutline = this.hideOutline.bind(this);
            return this;
        }
        , activate: function() {
            log('activating context menu');
            $(document)
                .on( 'contextmenu', this._onContextMenu )
                .on( 'click', this._clearDataAndHide );
            $(window)
                .on( 'click', this._hideOutline )
                .on( 'blur', this._hideOutline )
                .on( 'keydown', this._clearDataAndHide );
                // // DOES NOT WORK!  can't detect escape key on context menu.  why?  there is no oncontextclose event :\
                // .on( 'keydown', function( ev ) {
                //     log('KEYDOWN context: ', ev.keyCode );
                //     if ( ev.keyCode == 27 )
                //         this.hideOutline();
                // }.bind(this));
        }
        , deactivate: function() {
            log('DEactivating context menu');
            $(document)
                .off( 'contextmenu', this._onContextMenu )
                .off( 'click', this._clearDataAndHide );
            $(window)
                .off( 'click', this._hideOutline )
                .off( 'blur', this._hideOutline )
                .off( 'keydown', this._clearDataAndHide );
            this._clearDataAndHide();
        }
        , onContextMenu: function(ev) {
            log('STORED context menu details');
            this._target = $(ev.target);
            this._event = ev;
            if ( !ev.isDefaultPrevented() ) {
                log('SURROUND THIS GUY:', this._target );
                this.showOutline( this._target );
            }
        }
        , clearDataAndHide: function() {
            log('REMOVED context menu details');
            delete this._target;
            delete this._event;
            return this.hideOutline();
        }
        , addGuideAtContext: function( dir, color ) {
            this.hideOutline();
            if ( !this._event )
                return;
            log( 'Add guide from context at...', dir, this._target, this._event );
            new line( {
                color: color || 'lime'
                , dir: dir
                , pos: ( dir == 'horz' ? this._event.pageY : this._event.pageX ) - this.thickOffset
            }).focusTo();
        }
        , showOutline: function( target ) {
            this.hideOutline();
            if ( !target )
                return;
            target.addClass('guideLinr-element-highlight');
        }
        , hideOutline: function() {
            $('.guideLinr-element-highlight').removeClass('guideLinr-element-highlight');
        }
        , addGuideByElement: function( color, top, right, bottom, left ) {
            this.hideOutline();

            if ( !this._target )
                return;
            var offset = this._target.offset();
            
            if ( top )
                new line( {
                    color: color || 'lime'
                    , dir: 'horz'
                    , pos: ( offset.top ) - this.thickOffset
                }).focusTo();

            if ( right )
                new line( {
                    color: color || 'lime'
                    , dir: 'vert'
                    , pos: ( offset.left + this._target.outerWidth() ) - this.thickOffset
                }).focusTo();


            if ( left )
                new line( {
                    color: color || 'lime'
                    , dir: 'vert'
                    , pos: offset.left - this.thickOffset
                }).focusTo();
            
            if ( bottom )
                new line( {
                    color: color || 'lime'
                    , dir: 'horz'
                    , pos: ( offset.top + this._target.outerHeight() ) - this.thickOffset
                }).focusTo();
        }
    }).init();
    
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        log( 'REQUEST RECEIVED (in-page): ', request );

        var methods = {
            injectGuide: function() {
                createGuides(
                    request.guides
                    || { '': { color: request.color, dir: request.dir } }
                );
            }
            , clearAllGuides: function() {
                lines.withAll(function(line) {
                    line.destroy();
                });
            }
            , activateDistances: function() {
                distances.activate();
            }
            , deactivateDistances: function() {
                distances.deactivate();
            }
            , setSnapToPx: function() {
                lines.setSnap( request.snapToPx );
            }
            , setSnapToEls: function() {
                lines.setSnapEls( request.snapToEls );
            }
            , activateContextMenu: function() {
                contextMenu.activate();
            }
            , deactivateContextMenu: function() {
                contextMenu.deactivate();
            }
            , contextmenuaddvert: function() {
                contextMenu.addGuideAtContext('vert', request.color);
            }
            , contextmenuaddhorz: function() {
                contextMenu.addGuideAtContext('horz', request.color);
            }
            , contextmenusurround: function() {
                contextMenu.addGuideByElement( request.color, true, true, true, true );
            }
            , contextmenutop: function() {
                contextMenu.addGuideByElement( request.color, true );
            }
            , contextmenuright: function() {
                contextMenu.addGuideByElement( request.color, false, true );
            }
            , contextmenubottom: function() {
                contextMenu.addGuideByElement( request.color, false, false, true );
            }
            , contextmenuleft: function() {
                contextMenu.addGuideByElement( request.color, false, false, false, true );
            }
        };
        
        methods[request.method] && methods[request.method]();

        sendResponse({}); // cause success callback
    });
})();