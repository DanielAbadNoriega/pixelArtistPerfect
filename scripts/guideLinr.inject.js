(function() {

    var log = function() {
        return; // comment to allow logging!

        var args = Array.prototype.slice.call( arguments, 0 );
        args.unshift( 'guideLinr :: ' );
        return console.log.apply( console, args );
    };

    var COLOR_VERSION = 4;
    var DEFAULT_GUIDE_COLOR = 'rgb(197, 10, 235)';
    var LEGACY_DEFAULT_COLORS = [
        '#84cc16'
        , 'rgb(132, 204, 22)'
        , '#ef4444'
        , 'rgb(239, 68, 68)'
    ];
    var presetColors = [
        { name: 'Violeta', value: DEFAULT_GUIDE_COLOR }
        , { name: 'Rojo', value: '#ef4444' }
        , { name: 'Verde', value: '#84cc16' }
        , { name: 'Amarillo', value: '#facc15' }
        , { name: 'Azul', value: '#60a5fa' }
    ];
    var colors = presetColors.map(function( preset ) {
        return preset.value;
    });

    var defaultSettings = {
        showDistances: true
        , doContextMenu: true
        , snapToPx: ''
        , snapToEls: ''
        , selectedColor: DEFAULT_GUIDE_COLOR
        , selectedColorVersion: COLOR_VERSION
        , settingsLauncherPosition: null
    };

    var isValidCssColor = function( value ) {
        var style = document.createElement('span').style;
        style.color = '';
        style.color = $.trim( value || '' );
        return !!style.color;
    };

    var normalizeCssColor = function( value ) {
        var style = document.createElement('span').style
            , nextValue = $.trim( value || '' );

        if ( !nextValue )
            return defaultSettings.selectedColor;

        style.color = '';
        style.color = nextValue;
        return style.color || defaultSettings.selectedColor;
    };

    var colorToHex = function( value ) {
        var canvas = document.createElement('canvas').getContext('2d');
        canvas.fillStyle = normalizeCssColor( value );
        return canvas.fillStyle || defaultSettings.selectedColor;
    };

    var colorToRgbParts = function( value ) {
        var probe = $('<span>')
                .css({
                    position: 'absolute'
                    , left: '-9999px'
                    , top: '-9999px'
                    , color: normalizeCssColor( value )
                })
                .appendTo( document.body )
            , computed = probe.css('color')
            , match = computed && computed.match( /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i )
            , rgb = match
                ? {
                    r: parseInt( match[1], 10 )
                    , g: parseInt( match[2], 10 )
                    , b: parseInt( match[3], 10 )
                }
                : {
                    r: 239
                    , g: 68
                    , b: 68
                };

        probe.remove();
        return rgb;
    };

    var mixRgb = function( from, to, amount ) {
        amount = Math.max( 0, Math.min( 1, amount ) );
        return {
            r: Math.round( from.r + ( ( to.r - from.r ) * amount ) )
            , g: Math.round( from.g + ( ( to.g - from.g ) * amount ) )
            , b: Math.round( from.b + ( ( to.b - from.b ) * amount ) )
        };
    };

    var rgbToRgba = function( rgb, alpha ) {
        return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + alpha + ')';
    };

    var colorToRgba = function( value, alpha ) {
        return rgbToRgba( colorToRgbParts( value ), alpha );
    };

    var normalizeColorString = function( value ) {
        return String( value || '' ).toLowerCase().replace( /\s+/g, '' );
    };

    var shouldMigrateDefaultColor = function( value ) {
        if ( !value )
            return true;

        var normalized = normalizeColorString( value );
        for ( var i = 0, len = LEGACY_DEFAULT_COLORS.length; i < len; i++ ) {
            if ( normalized == normalizeColorString( LEGACY_DEFAULT_COLORS[i] ) )
                return true;
        }

        return false;
    };

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
        , getAll: function( dir ) {
            var arr = [];
            this.withAll(function( guide ) {
                if ( !dir || guide._dir == dir )
                    arr.push( guide );
            });
            return arr;
        }
        , clear: function( dir ) {
            var guides = this.getAll( dir );
            for ( var i = 0, len = guides.length; i < len; i++ )
                guides[i].destroy();
            return guides.length;
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
        this._color = normalizeCssColor( options.color );

        //log( 'options: ', options );

        this._ = $('<div>')
                    .addClass( [ 'guideLinr-line', this._dir ].join(' ') )
                    .attr( 'tabIndex', '0' ) // so it can receive keyboard focus
                    .on( 'mousedown', this.dragMouseDown.bind(this) )
                    .on( 'mousemove', this.dialogMouseMove.bind(this) )
                    .on( 'mouseout', this.dialogMouseOut.bind(this) )
                    .on( 'contextmenu', this.dialogContextMenu.bind(this) )
                    .on( 'keydown', this.keyDown.bind(this) )
                    .appendTo( document.body )
                    .fadeIn('fast');
        this._.data( 'guideLinrLine', this );

        this.setColor( this._color );

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
            chrome.runtime.sendMessage(
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
        , setColor: function( color ) {
            this._color = normalizeCssColor( color );
            this._.css({
                '--guide-line-color': this._color
                , color: this._color
            });
            return this;
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
            if ( deleteMode.isActive() ) {
                clearTimeout( this._dialogTimer );
                return;
            }
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
            if ( deleteMode.shouldSuppressMenus() ) {
                ev.preventDefault();
                ev.stopPropagation();
                return false;
            }
            if ( !this._dialog ) { // if right click
                ev.preventDefault();
                this._dialog = new dialog( this, ev );
            }
        }

        , dragMouseDown: function(ev) {
            if ( deleteMode.isActive() ) {
                ev.preventDefault();
                ev.stopPropagation();
                clearTimeout( this._dialogTimer );
                if ( this._dialog )
                    this._dialog.destroy();
                this.destroy();
                return;
            }

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
            if ( ev.keyCode == 8 || ev.keyCode == 46 ) {
                ev.preventDefault();
                ev.stopPropagation();
                this.destroy();
                return;
            }

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

        , destroy: function( options ) {
            options = options || {};
            clearTimeout( this._dialogTimer );

            if ( !options.skipStorage ) {
                chrome.runtime.sendMessage(
                    {
                        method: "removeGuide"
                        , url: location.href
                        , id: this._id
                    }
                    , function(response) {
                        if ( chrome.runtime.lastError )
                            return;

                        if ( response && response.success === false )
                            alert('Really sorry, but there was a problem saving something.  This line might show back up');
                    }
                );
            }

            lines.remove( this );

            if ( this._dialog )
                this._dialog.destroy();

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

    var dialogIcons = {
        delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6m-9 4h12M8 7l1 12h6l1-12M10 10v6M14 10v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        , rotate: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        , color: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c4.97 0 9 3.36 9 7.5 0 2.6-1.74 4.16-4.16 4.16h-1.18a1.66 1.66 0 0 0-1.66 1.66c0 .35.1.69.28.99.4.65.22 1.49-.41 1.93A3.88 3.88 0 0 1 11.56 20C6.83 20 3 16.19 3 11.5 3 6.81 7.03 3 12 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="8.5" cy="10" r="1" fill="currentColor"></circle><circle cx="12" cy="8" r="1" fill="currentColor"></circle><circle cx="15.5" cy="10" r="1" fill="currentColor"></circle></svg>'
        , close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 9l-6 6M9 9l6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
        , custom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
    };

    var dialog = function( line, mouseEvent ) {
        if ( line._dialog )
            return; // this line already has a dialog!

        this.line = line;
        this.icons = {};
        this.$colorPopover = null;
        this._suspendAutoClose = false;
        this._ = $('<div>')
                    .addClass('guideLinr-dialog ' + line._dir)
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
        this.renderDefaultActions();

        this._.on( 'click', '.guideLinr-icon, .guideLinr-dialog-color-picker', function(ev) {
            setTimeout( function() {
                this.line.focusTo(); // so keyboard events will still work after orientation switch
            }.bind(this), 0 );
        }.bind(this));
    }
    dialog.prototype = {
        mouseOut: function() {
            clearTimeout( this._timer );
            if ( this._suspendAutoClose )
                return;
            this._timer = setTimeout( this.destroy.bind(this), 500 );
        }
        , mouseOver: function() {
            clearTimeout( this._timer );
        }
        , destroy: function() {
            this.destroyColorPopover();
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
            var icon = $('<button type="button">')
                .addClass('guideLinr-icon guideLinr-icon-button ' + addOnClass)
                .html( dialogIcons[addOnClass] || '' );
            if ( title )
                icon.attr('title', title);
            return icon;
        }
        , clearContent: function() {
            this.destroyColorPopover();
            this._.children().remove();
        }
        , suspendAutoClose: function( shouldSuspend ) {
            this._suspendAutoClose = !!shouldSuspend;
            if ( shouldSuspend )
                clearTimeout( this._timer );
        }
        , destroyColorPopover: function() {
            this.suspendAutoClose( false );
            if ( this.$colorPopover ) {
                this.$colorPopover.remove();
                this.$colorPopover = null;
            }
            if ( this.icons.color )
                this.icons.color.removeClass('active');
        }
        , applyLineColor: function( color ) {
            this.line.setColor( color );
            this.line.save();
            this.line.fireMovedEvent();
        }
        , renderDefaultActions: function() {
            this.clearContent();

            this.icons.del = this.createIcon('delete', 'Eliminar guía')
                .appendTo( this._ )
                .on( 'click', function() {
                    this.line.destroy();
                    this.destroy();
                }.bind(this));

            this.icons.rot = this.createIcon('rotate', 'Rotar guía')
                .appendTo( this._ )
                .on( 'click', function( ev ) {
                    this.destroy();
                    var goingVert = this.line._dir == 'horz';
                    this.line._dir = goingVert ? 'vert' : 'horz';
                    this.line._
                        .removeClass( goingVert ? 'horz' : 'vert' )
                        .addClass( goingVert ? 'vert' : 'horz' );
                    this.line.resizeRoutineHeavy();
                    this.line.dragMouseMove( ev );
                }.bind(this));

            this.icons.color = this.createIcon('color', 'Cambiar color')
                .appendTo( this._ )
                .on( 'click', this.clickColor.bind(this));
        }

        , clickColor: function() {
            if ( this.$colorPopover ) {
                this.destroyColorPopover();
                return;
            }

            var popover = $('<div>')
                .addClass('guideLinr-dialog-color-popover')
                .appendTo( this._ );

            this.$colorPopover = popover;
            this.icons.color.addClass('active');

            this.createIcon('close', 'Cerrar paleta')
                .appendTo( popover )
                .on( 'click', function( ev ) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.destroyColorPopover();
                }.bind(this) );

            for ( var i = 0, len = presetColors.length; i < len; i++ ) {
                $('<button type="button">')
                    .addClass('guideLinr-icon guideLinr-icon-button custom-color-swatch')
                    .appendTo( popover )
                    .attr( 'title', presetColors[i].name )
                    .css( 'background-color', presetColors[i].value )
                    .data('color', presetColors[i].value)
                    .toggleClass( 'active', colorToHex( presetColors[i].value ) == colorToHex( this.line._color ) )
                    .on( 'click', function( ev ) {
                        this.applyLineColor( $(ev.currentTarget).data('color') );
                        this.destroyColorPopover();
                    }.bind(this) );
            }

            var customPicker = $('<label>')
                .addClass('guideLinr-dialog-color-picker-shell')
                .attr( 'title', 'Elegir color personalizado' )
                .append(
                    $('<span>')
                        .addClass('guideLinr-dialog-color-picker-preview')
                        .css( 'background-color', this.line._color )
                    , $('<span>')
                        .addClass('guideLinr-dialog-color-picker-icon')
                        .html( dialogIcons.custom )
                )
                .appendTo( popover );

            $('<input type="color" class="guideLinr-dialog-color-picker">')
                .attr( 'title', 'Elegir color personalizado' )
                .val( colorToHex( this.line._color ) )
                .appendTo( customPicker )
                .on( 'mousedown click focus', function() {
                    this.suspendAutoClose( true );
                }.bind(this) )
                .on( 'input', function( ev ) {
                    customPicker.find('.guideLinr-dialog-color-picker-preview').css( 'background-color', ev.target.value );
                    this.applyLineColor( ev.target.value );
                }.bind(this) )
                .on( 'change blur', function() {
                    setTimeout(function() {
                        this.destroyColorPopover();
                    }.bind(this), 0);
                }.bind(this) );

            popover.on( 'click', function( ev ) {
                ev.stopPropagation();
            });
        }
    };

    var clearGuidesByDirection = function( dir ) {
        var guides = lines.getAll( dir )
            , ids = $.map( guides, function( guide ) {
                return guide._id;
            } );

        deleteMode.deactivate();

        for ( var i = 0, len = guides.length; i < len; i++ )
            guides[i].destroy({ skipStorage: true });

        if ( !ids.length )
            return 0;

        chrome.runtime.sendMessage(
            {
                method: dir ? 'removeGuides' : 'clearGuides'
                , url: location.href
                , ids: ids
            }
            , function() {
                void chrome.runtime.lastError;
            }
        );

        return ids.length;
    };

    var deleteMode = ({
        active: false
        , suppressMenusUntil: 0
        , init: function() {
            this.body = $(document.body);
            this.render();
            this.bindEvents();
            return this;
        }
        , render: function() {
            this.$badge = $('<div>')
                .addClass('guideLinr-delete-badge')
                .text('Borrado múltiple activo · haz clic en las guías que quieras quitar · Esc cancela')
                .appendTo( document.body )
                .hide();
        }
        , bindEvents: function() {
            this._onKeyDown = this.onKeyDown.bind(this);
            this._onMouseDown = this.onMouseDown.bind(this);
            $(document).on( 'keydown', this._onKeyDown );
            $(document).on( 'mousedown', this._onMouseDown );
        }
        , onKeyDown: function( ev ) {
            if ( this.active && ev.keyCode == 27 ) {
                ev.preventDefault();
                this.deactivate();
            }
        }
        , onMouseDown: function( ev ) {
            if ( !this.active )
                return;

            var $line = $(ev.target).closest('.guideLinr-line')
                , guide = $line.data('guideLinrLine');

            if ( !guide )
                return;

            ev.preventDefault();
            ev.stopPropagation();
            this.suppressMenus();
            guide.destroy();
        }
        , isActive: function() {
            return !!this.active;
        }
        , suppressMenus: function() {
            this.suppressMenusUntil = Date.now() + 600;
        }
        , shouldSuppressMenus: function() {
            return this.active || Date.now() < this.suppressMenusUntil;
        }
        , activate: function() {
            if ( this.active )
                return;
            this.active = true;
            this.body.addClass('guideLinr-delete-mode');
            this.$badge.stop(true, true).fadeIn('fast');
            this.body.trigger( 'guideLinrDeleteModeChanged', [ true ] );
        }
        , deactivate: function() {
            if ( !this.active )
                return;
            this.active = false;
            this.body.removeClass('guideLinr-delete-mode');
            this.$badge.stop(true, true).fadeOut('fast');
            this.body.trigger( 'guideLinrDeleteModeChanged', [ false ] );
        }
        , toggle: function() {
            if ( this.active )
                this.deactivate();
            else
                this.activate();
        }
    }).init();


    var distances = {
        timer: null
        , debouncedDraw: function( ev ) {
            clearTimeout( this.timer );
            this.timer = setTimeout( this.draw.bind(this), 5 ); // because some events happen near simultaneously
        }
        , clamp: function( value, min, max ) {
            return Math.max( min, Math.min( value, max ) );
        }
        , getEditorPosition: function( dist, input ) {
            var rect = dist[0].getBoundingClientRect()
                , inputWidth = input.outerWidth()
                , inputHeight = input.outerHeight()
                , padding = 8;

            if ( dist.hasClass('horz') ) {
                return {
                    left: this.clamp(
                        rect.right + 12
                        , padding
                        , window.innerWidth - inputWidth - padding
                    ) + 'px'
                    , top: this.clamp(
                        rect.top + Math.floor( ( rect.height - inputHeight ) / 2 )
                        , padding
                        , window.innerHeight - inputHeight - padding
                    ) + 'px'
                };
            }

            return {
                left: this.clamp(
                    rect.left + Math.floor( ( rect.width - inputWidth ) / 2 )
                    , padding
                    , window.innerWidth - inputWidth - padding
                ) + 'px'
                , top: this.clamp(
                    rect.bottom + 10
                    , padding
                    , window.innerHeight - inputHeight - padding
                ) + 'px'
            };
        }
        , destroyEditor: function() {
            if ( !this._editor )
                return;
            this._editor.input.off().remove();
            this._editor.dist.removeClass('editing');
            delete this._editor;
        }
        , startEdit: function( dist ) {
            var editData = dist && dist.data('guideLinrDistanceEdit');
            if ( !editData || !editData.targetGuide )
                return;

            this.destroyEditor();

            var input = $('<input type="number" min="0" step="1" class="guideLinr-distance-input">')
                    .val( editData.size )
                    .appendTo( document.body );

            input.css( this.getEditorPosition( dist, input ) );

            this._editor = {
                dist: dist
                , input: input
                , editData: editData
            };

            dist.addClass('editing');

            input
                .on( 'mousedown click', function(ev) {
                    ev.stopPropagation();
                })
                .on( 'keydown', function(ev) {
                    if ( ev.keyCode == 13 ) {
                        ev.preventDefault();
                        this.applyEdit();
                    } else if ( ev.keyCode == 27 ) {
                        ev.preventDefault();
                        this.destroyEditor();
                    }
                }.bind(this))
                .on( 'blur', this.applyEdit.bind(this) )
                .on( 'input', function() {
                    input.css( this.getEditorPosition( dist, input ) );
                }.bind(this) );

            input.trigger('focus').trigger('select');
        }
        , applyEdit: function() {
            if ( !this._editor )
                return;

            var editor = this._editor
                , nextValue = parseInt( $.trim(editor.input.val()), 10 );

            this.destroyEditor();

            if ( isNaN(nextValue) )
                return;

            nextValue = Math.max( 0, nextValue );
            if ( nextValue == editor.editData.size )
                return;

            var targetGuide = editor.editData.targetGuide
                , snap = lines.getSnap()
                , moveDirection = editor.editData.moveDirection || 1
                , diff = nextValue - editor.editData.size
                , nextPosition = Math.max( 0, targetGuide.getPosition() + ( diff * moveDirection ) );

            targetGuide.snapPosition(
                nextPosition
                + ( snap ? targetGuide._thickOffset : 0 )
            );
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
        , getColorBuckets: function( guides ) {
            var buckets = []
                , lookup = {};

            for ( var i = 0, len = guides.length; i < len; i++ ) {
                var color = guides[i]._color;
                if ( !lookup[color] ) {
                    lookup[color] = [];
                    buckets.push({
                        color: color
                        , guides: lookup[color]
                    });
                }
                lookup[color].push( guides[i] );
            }

            return buckets;
        }

        , removeAll: function() {
            this.destroyEditor();
            if ( this.cache ) {
                $.each( this.cache, function(i, dist) {
                    dist.remove();
                });
                delete this.cache;
            }
            this.cache = [];
        }
        , applyBucketColorStyle: function( dist, color ) {
            var base = colorToRgbParts( color )
                , lighter = mixRgb( base, { r: 255, g: 255, b: 255 }, 0.18 )
                , darker = mixRgb( base, { r: 15, g: 23, b: 42 }, 0.12 );

            return dist.css({
                '--guide-distance-tint-soft': rgbToRgba( darker, 0.34 )
                , '--guide-distance-tint-strong': rgbToRgba( lighter, 0.58 )
                , '--guide-distance-border': rgbToRgba( base, 0.72 )
                , '--guide-distance-glow': rgbToRgba( base, 0.42 )
                , '--guide-distance-sheen': rgbToRgba( lighter, 0.2 )
                , 'background-color': rgbToRgba( base, 0.26 )
                , 'background-image': 'linear-gradient(145deg, ' + rgbToRgba( lighter, 0.34 ) + ', ' + rgbToRgba( darker, 0.46 ) + ')'
                , 'border-color': rgbToRgba( base, 0.58 )
                , 'box-shadow': [
                    '0 10px 24px rgba(0, 0, 0, 0.18)'
                    , 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                    , 'inset 0 0 0 1px ' + rgbToRgba( base, 0.18 )
                    , '0 0 18px -12px ' + rgbToRgba( base, 0.34 )
                ].join(', ')
            });
        }
        , makeDistanceEditable: function( dist, size, targetGuide, moveDirection, placement ) {
            dist.append(
                $('<span>')
                    .addClass('guideLinr-distance-label')
                    .text( size + 'px' )
                    .css( placement || {} )
            );

            if ( !targetGuide )
                return dist.attr( 'title', size + 'px' );

            dist
                .addClass('editable')
                .attr( 'title', size + 'px · Click to edit this distance' )
                .data( 'guideLinrDistanceEdit', {
                    size: size
                    , targetGuide: targetGuide
                    , moveDirection: moveDirection || 1
                })
                .on( 'click', function(ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    this.startEdit( $(ev.currentTarget) );
                }.bind(this) );

            return dist;
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

            var vertBuckets = this.getColorBuckets( ordered.vert )
                , horzBuckets = this.getColorBuckets( ordered.horz );

            for ( var c = 0, clen = vertBuckets.length; c < clen; c++ ) {
                var guides = vertBuckets[c].guides
                    , bucketColor = vertBuckets[c].color;
                if ( guides.length ) {
                    for ( var i = -1, ilen = guides.length; i < ilen; i++ ) {
                        var pos1 = guides[i+1] ? guides[i+1].getPosition() : docWidth
                            , pos2 = guides[i] ? guides[i].getPosition() : 0
                            , offset = guides[i] ? vertWidth : 0
                            , editableGuide = guides[i+1] || guides[i]
                            , moveDirection = guides[i+1] ? 1 : -1
                            , wid = ( pos1 - pos2 )
                                    + ( !guides[i] ? vertWidth : 0 ) // for the one on the leftmost
                                    - ( !guides[i+1] ? vertWidth : 0 ); // for the one on the rightmost
                        var dist = $('<div>')
                            .addClass('guideLinr-distance')
                            .css({
                                left: ( ( pos2 + offset ) - scrollLeft ) + 'px'
                                , top: top + 'px'
                                , width: wid + 'px'
                            });
                        this.applyBucketColorStyle( dist, bucketColor );
                        this.makeDistanceEditable( dist, wid, editableGuide, moveDirection )
                            .appendTo( document.body );
                        this.cache.push( dist );
                    }
                    top += dist.height();
                }
            }

            for ( var h = 0, hlen = horzBuckets.length; h < hlen; h++ ) {
                var guides = horzBuckets[h].guides
                    , bucketColor = horzBuckets[h].color;
                if ( guides.length ) {
                    for ( var i = -1, ilen = guides.length; i < ilen; i++ ) {
                        var pos1 = guides[i+1] ? guides[i+1].getPosition() : docHeight
                            , pos2 = guides[i] ? guides[i].getPosition() : 0
                            , offset = guides[i] ? horzHeight : 0
                            , editableGuide = guides[i+1] || guides[i]
                            , moveDirection = guides[i+1] ? 1 : -1
                            , hei = ( pos1 - pos2 )
                                    + ( !guides[i] ? horzHeight : 0 ) // for the one at the very top
                                    - ( !guides[i+1] ? horzHeight : 0 ); // for the one at the very bottom
                        var dist = $('<div>')
                            .addClass('guideLinr-distance horz')
                            .css({
                                top: ( ( pos2 + offset ) - scrollTop ) + 'px'
                                , left: left + 'px'
                                , height: hei + 'px'
                            });
                        this.applyBucketColorStyle( dist, bucketColor );
                        this.makeDistanceEditable( dist, hei, editableGuide, moveDirection )
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
            this.deactivate();
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
            if ( deleteMode.shouldSuppressMenus() ) {
                ev.preventDefault();
                ev.stopPropagation();
                this.clearDataAndHide();
                return false;
            }
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
                color: color || defaultSettings.selectedColor
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
                    color: color || defaultSettings.selectedColor
                    , dir: 'horz'
                    , pos: ( offset.top ) - this.thickOffset
                }).focusTo();

            if ( right )
                new line( {
                    color: color || defaultSettings.selectedColor
                    , dir: 'vert'
                    , pos: ( offset.left + this._target.outerWidth() ) - this.thickOffset
                }).focusTo();


            if ( left )
                new line( {
                    color: color || defaultSettings.selectedColor
                    , dir: 'vert'
                    , pos: offset.left - this.thickOffset
                }).focusTo();
            
            if ( bottom )
                new line( {
                    color: color || defaultSettings.selectedColor
                    , dir: 'horz'
                    , pos: ( offset.top + this._target.outerHeight() ) - this.thickOffset
                }).focusTo();
        }
    }).init();

    var settingsUi = ({
        settings: $.extend( {}, defaultSettings )
        , visible: false
        , init: function() {
            this.render();
            this.bindEvents();
            this.loadSettings();
            return this;
        }
        , render: function() {
            this._ = $('<div>')
                .addClass('guideLinr-settings-root hidden')
                .appendTo( document.body );

            this.$toggle = $('<button type="button">')
                .addClass('guideLinr-settings-toggle')
                .attr( 'title', 'Abrir ajustes rápidos de PixelFromen Studio' )
                .append(
                    $('<span>')
                        .addClass('guideLinr-settings-toggle-icon')
                        .text('⚙')
                )
                .appendTo( this._ );

            this.$panel = $('<div>')
                .addClass('guideLinr-settings-panel')
                .appendTo( this._ );

            this.$help = $('<div>')
                .addClass('guideLinr-settings-help')
                .append(
                    $('<p>').html('<strong>Atajos rápidos</strong>: usa los comandos de la extensión para crear guías, abrir estos ajustes y limpiar la página.')
                    , $('<p>').html('<strong>Atajos sobre la página</strong>: <strong>Alt/Option + Shift + I</strong> limpia verticales · <strong>+ L</strong> horizontales · <strong>+ D</strong> activa el borrado múltiple.')
                    , $('<p>').html('<strong>Borrado múltiple</strong>: activa el modo y haz clic en las guías que quieras quitar. <strong>Esc</strong> cancela.')
                    , $('<p>').html('<strong>Menú contextual</strong>: agrega acciones al clic derecho para crear guías alrededor del elemento bajo el cursor.')
                    , $('<p>').html('<strong>Retícula de movimiento</strong>: hace que las guías se muevan en saltos fijos, por ejemplo cada 10 px.')
                    , $('<p>').html('<strong>Sensibilidad del imán a bordes</strong>: al arrastrar, la guía se pega a los bordes de elementos HTML de la página si pasas dentro del rango elegido.')
                    , $('<p>').html('<strong>Más atajos</strong>: puedes verlos o personalizarlos desde el popup y en <code>chrome://extensions/shortcuts</code>.')
                )
                .appendTo( this.$panel );

            this.$panel
                .append(
                    $('<div>')
                        .addClass('guideLinr-settings-panel-header')
                        .append(
                            $('<div>')
                                .append(
                                    $('<div>')
                                        .addClass('guideLinr-settings-title')
                                        .text('PixelFromen Studio')
                                    , $('<div>')
                                        .addClass('guideLinr-settings-subtitle')
                                        .text('Controles rápidos sobre la página')
                                )
                            , $('<div>')
                                .addClass('guideLinr-settings-header-actions')
                                .append(
                                    $('<button type="button" class="guideLinr-settings-icon-button" data-action="toggle-help" title="Información">').text('i')
                                    , $('<button type="button" class="guideLinr-settings-icon-button" data-action="hide-widget" title="Ocultar controles flotantes">').text('×')
                                )
                        )
                )
                .append(
                    $('<label>')
                        .addClass('guideLinr-settings-field checkbox')
                        .append(
                            $('<input type="checkbox" data-setting="showDistances">')
                            , $('<span>').text('Mostrar distancias entre guías')
                        )
                    , $('<label>')
                        .addClass('guideLinr-settings-field checkbox')
                        .append(
                            $('<input type="checkbox" data-setting="doContextMenu">')
                            , $('<span>').text('Activar acciones en el menú contextual')
                        )
                    , $('<label>')
                        .addClass('guideLinr-settings-field')
                        .append(
                            this.buildFieldHeading(
                                'Retícula de movimiento'
                                , 'Hace que la guía se mueva en saltos fijos. Si eliges 10 px, caerá en 0, 10, 20, 30...'
                            )
                            , $('<select data-setting="snapToPx">')
                                .append( this.buildGridSnapOptions() )
                        )
                    , $('<label>')
                        .addClass('guideLinr-settings-field')
                        .append(
                            this.buildFieldHeading(
                                'Sensibilidad del imán a bordes'
                                , 'Al arrastrar, la guía se pega a los bordes de elementos HTML de la página. Este valor marca lo cerca que tienes que pasar para que se active ese imán.'
                                , true
                            )
                            , $('<select data-setting="snapToEls">')
                                .append( this.buildEdgeSnapOptions() )
                        )
                    , $('<div>')
                        .addClass('guideLinr-settings-field')
                        .append(
                            $('<span>').text('Color de guía')
                            , $('<div>')
                                .addClass('guideLinr-settings-color-controls')
                                .append(
                                    $('<div>')
                                        .addClass('guideLinr-settings-swatches')
                                        .append( this.buildPresetSwatches() )
                                    , $('<div>')
                                        .addClass('guideLinr-settings-color-row')
                                        .append(
                                            $('<input type="color" class="guideLinr-settings-color-picker">')
                                            , $('<input type="text" class="guideLinr-settings-color-text" placeholder="rgb(197, 10, 235) o #c50aeb">')
                                            , $('<span>')
                                                .addClass('guideLinr-settings-color-preview')
                                        )
                                )
                        )
                    , $('<div>')
                        .addClass('guideLinr-settings-actions')
                        .append(
                            $('<button type="button" data-action="add-vert">').text('Añadir vertical')
                            , $('<button type="button" data-action="add-horz">').text('Añadir horizontal')
                            , $('<button type="button" data-action="toggle-delete-mode" class="guideLinr-settings-delete-toggle">').text('Borrado múltiple')
                            , $('<button type="button" data-action="clear-guides" class="guideLinr-settings-button-danger">').text('Limpiar página')
                            , $('<button type="button" data-action="clear-vert">').text('Limpiar verticales')
                            , $('<button type="button" data-action="clear-horz">').text('Limpiar horizontales')
                        )
                    , $('<button type="button" class="guideLinr-settings-clear" data-action="hide-widget">')
                        .text('Ocultar controles flotantes')
                    , $('<div>')
                        .addClass('guideLinr-settings-shortcuts')
                        .text('Consejo: puedes volver a mostrar estos controles desde el popup o con el atajo de ajustes.')
                );

            this.$colorPreview = this.$panel.find('.guideLinr-settings-color-preview');
            this.$colorPicker = this.$panel.find('.guideLinr-settings-color-picker');
            this.$colorText = this.$panel.find('.guideLinr-settings-color-text');
            this.applyLauncherPosition( this.getDefaultLauncherPosition() );
        }
        , bindEvents: function() {
            this._toggleClick = this.toggleClick.bind(this);
            this._toggleMouseDown = this.toggleMouseDown.bind(this);
            this._panelPointerDown = function(ev) {
                ev.stopPropagation();
            };
            this._documentPointerDown = this.handleDocumentPointerDown.bind(this);
            this._windowResize = this.handleWindowResize.bind(this);
            this._storageChanged = this.handleStorageChanged.bind(this);
            this._deleteModeChanged = this.handleDeleteModeChanged.bind(this);

            this.$toggle
                .on( 'click', this._toggleClick )
                .on( 'mousedown', this._toggleMouseDown );

            this.$panel.on( 'mousedown click', this._panelPointerDown );
            this.$panel.on( 'change', '[data-setting]', this.handleControlChange.bind(this) );
            this.$panel.on( 'click', '[data-action]', this.handleActionClick.bind(this) );
            this.$panel.on( 'click', '.guideLinr-settings-swatch', this.handleSwatchClick.bind(this) );
            this.$colorPicker.on( 'input change', this.handleColorPickerChange.bind(this) );
            this.$colorText
                .on( 'input', this.handleColorTextInput.bind(this) )
                .on( 'change blur', this.handleColorTextCommit.bind(this) )
                .on( 'keydown', function( ev ) {
                    if ( ev.keyCode == 13 ) {
                        ev.preventDefault();
                        this.handleColorTextCommit( ev );
                    }
                }.bind(this));

            $(document).on( 'mousedown', this._documentPointerDown );
            $(window).on( 'resize', this._windowResize );
            $(document.body).on( 'guideLinrDeleteModeChanged', this._deleteModeChanged );
            chrome.storage.onChanged.addListener( this._storageChanged );
        }
        , buildPresetSwatches: function() {
            return $.map( presetColors, function( preset ) {
                return $('<button type="button">')
                    .addClass('guideLinr-settings-swatch')
                    .attr({
                        'data-color': preset.value
                        , 'title': preset.name + ' · ' + preset.value
                    })
                    .css( 'background-color', preset.value )[0];
            });
        }
        , buildFieldHeading: function( text, tooltip, alignRight ) {
            return $('<span>')
                .addClass('guideLinr-settings-label-row')
                .append(
                    $('<span>').text( text )
                    , $('<button type="button">')
                        .addClass('guideLinr-settings-inline-info' + ( alignRight ? ' guideLinr-settings-inline-info-right' : '' ))
                        .attr({
                            'aria-label': 'Información sobre ' + text.toLowerCase()
                            , 'data-tooltip': tooltip
                        })
                        .text('i')
                );
        }
        , buildGridSnapOptions: function() {
            return [
                $('<option value="">').text('Libre')[0]
                , $('<option value="5">').text('Cada 5 px')[0]
                , $('<option value="10">').text('Cada 10 px')[0]
                , $('<option value="15">').text('Cada 15 px')[0]
                , $('<option value="20">').text('Cada 20 px')[0]
                , $('<option value="25">').text('Cada 25 px')[0]
                , $('<option value="50">').text('Cada 50 px')[0]
                , $('<option value="100">').text('Cada 100 px')[0]
            ];
        }
        , buildEdgeSnapOptions: function() {
            return [
                $('<option value="">').text('Desactivado')[0]
                , $('<option value="5">').text('5 px · muy preciso')[0]
                , $('<option value="10">').text('10 px · equilibrado')[0]
                , $('<option value="15">').text('15 px · sensible')[0]
                , $('<option value="20">').text('20 px · muy sensible')[0]
            ];
        }
        , loadSettings: function() {
            chrome.storage.local.get( defaultSettings, function( storedSettings ) {
                var payload = {};

                if ( storedSettings.selectedColorVersion !== COLOR_VERSION ) {
                    payload.selectedColorVersion = COLOR_VERSION;
                    if ( shouldMigrateDefaultColor( storedSettings.selectedColor ) )
                        payload.selectedColor = defaultSettings.selectedColor;

                    chrome.storage.local.set( payload );
                    storedSettings = $.extend( {}, storedSettings, payload );
                }

                this.applySettings( storedSettings );
            }.bind(this) );
        }
        , applySettings: function( nextSettings ) {
            this.settings = $.extend( {}, this.settings, nextSettings );
            this.settings.selectedColor = normalizeCssColor( this.settings.selectedColor );

            lines.setSnap( this.settings.snapToPx );
            lines.setSnapEls( this.settings.snapToEls );

            if ( this.settings.showDistances )
                distances.activate();
            else
                distances.deactivate();

            if ( this.settings.doContextMenu )
                contextMenu.activate();
            else
                contextMenu.deactivate();

            this.renderState();
        }
        , updateColorPreview: function( color, isValid ) {
            this.$colorPreview.css( 'background-color', isValid ? normalizeCssColor(color) : 'transparent' );
            this.$colorText.toggleClass( 'invalid', !isValid );
        }
        , renderState: function() {
            this.$panel.find('[data-setting="showDistances"]').prop( 'checked', !!this.settings.showDistances );
            this.$panel.find('[data-setting="doContextMenu"]').prop( 'checked', !!this.settings.doContextMenu );
            this.$panel.find('[data-setting="snapToPx"]').val( this.settings.snapToPx || '' );
            this.$panel.find('[data-setting="snapToEls"]').val( this.settings.snapToEls || '' );
            this.$colorPicker.val( colorToHex( this.settings.selectedColor ) );
            this.$colorText.val( this.settings.selectedColor );
            this.updateColorPreview( this.settings.selectedColor, true );
            this.$panel.find('.guideLinr-settings-swatch').removeClass('active').filter(function() {
                return colorToHex( $(this).data('color') ) == colorToHex( normalizeCssColor( this.settings.selectedColor ) );
            }.bind(this)).addClass('active');
            this.renderDeleteModeState();

            this.applyLauncherPosition(
                this.settings.settingsLauncherPosition
                || this.getDefaultLauncherPosition()
            );
        }
        , persistSetting: function( key, value ) {
            var payload = {};
            payload[key] = value;
            this.applySettings( payload );
            chrome.storage.local.set( payload );
        }
        , applySelectedColor: function( color ) {
            if ( !isValidCssColor( color ) )
                return false;

            this.persistSetting( 'selectedColor', normalizeCssColor( color ) );
            return true;
        }
        , handleControlChange: function( ev ) {
            var $target = $(ev.target)
                , setting = $target.data('setting')
                , value;

            if ( setting == 'showDistances' || setting == 'doContextMenu' )
                value = !!ev.target.checked;
            else
                value = $target.val();

            this.persistSetting( setting, value );
        }
        , handleSwatchClick: function( ev ) {
            this.applySelectedColor( $(ev.currentTarget).data('color') );
        }
        , handleColorPickerChange: function( ev ) {
            this.applySelectedColor( ev.target.value );
        }
        , handleColorTextInput: function( ev ) {
            var value = $(ev.target).val();
            this.updateColorPreview( value, isValidCssColor( value ) );
        }
        , handleColorTextCommit: function( ev ) {
            var value = $(ev.target).val();
            if ( !value )
                value = defaultSettings.selectedColor;

            if ( !this.applySelectedColor( value ) )
                this.renderState();
        }
        , handleActionClick: function( ev ) {
            var action = $(ev.currentTarget).data('action');

            if ( action == 'add-vert' )
                return new line({
                    color: this.settings.selectedColor
                    , dir: 'vert'
                }).focusTo();

            if ( action == 'add-horz' )
                return new line({
                    color: this.settings.selectedColor
                    , dir: 'horz'
                }).focusTo();

            if ( action == 'clear-guides' )
                return clearGuidesByDirection();

            if ( action == 'clear-vert' )
                return clearGuidesByDirection( 'vert' );

            if ( action == 'clear-horz' )
                return clearGuidesByDirection( 'horz' );

            if ( action == 'toggle-delete-mode' ) {
                deleteMode.toggle();
                return this.renderDeleteModeState();
            }

            if ( action == 'toggle-help' )
                return this.$help.toggleClass('open');

            if ( action == 'hide-widget' )
                return this.hideLauncher();
        }
        , renderDeleteModeState: function() {
            this.$panel
                .find('.guideLinr-settings-delete-toggle')
                .toggleClass( 'active', deleteMode.isActive() )
                .text( deleteMode.isActive() ? 'Cancelar borrado múltiple' : 'Borrado múltiple' );
        }
        , clamp: function( value, min, max ) {
            return Math.max( min, Math.min( value, max ) );
        }
        , getDefaultLauncherPosition: function() {
            return {
                top: 16
                , left: Math.max( 16, window.innerWidth - 72 )
            };
        }
        , normalizeLauncherPosition: function( position ) {
            position = position || this.getDefaultLauncherPosition();
            return {
                top: this.clamp( parseInt(position.top, 10) || 16, 12, Math.max( 12, window.innerHeight - 56 ) )
                , left: this.clamp( parseInt(position.left, 10) || 16, 12, Math.max( 12, window.innerWidth - 56 ) )
            };
        }
        , applyLauncherPosition: function( position ) {
            this.settings.settingsLauncherPosition = this.normalizeLauncherPosition( position );
            this.$toggle.css({
                top: this.settings.settingsLauncherPosition.top + 'px'
                , left: this.settings.settingsLauncherPosition.left + 'px'
            });

            if ( this.visible && this.$panel.hasClass('open') )
                this.positionPanel();
        }
        , positionPanel: function() {
            var rect = this.$toggle[0].getBoundingClientRect()
                , panelWidth = this.$panel.outerWidth()
                , panelHeight = this.$panel.outerHeight()
                , left = this.clamp(
                    rect.right - panelWidth
                    , 12
                    , window.innerWidth - panelWidth - 12
                )
                , top = rect.bottom + 12;

            if ( top + panelHeight > window.innerHeight - 12 )
                top = rect.top - panelHeight - 12;

            top = this.clamp(
                top
                , 12
                , window.innerHeight - panelHeight - 12
            );

            this.$panel.css({
                top: top + 'px'
                , left: left + 'px'
            });
        }
        , setVisible: function( isVisible ) {
            this.visible = !!isVisible;
            this._.toggleClass( 'hidden', !this.visible );
            if ( !this.visible ) {
                this.closePanel();
                this.$help.removeClass('open');
            }
        }
        , showLauncher: function( openPanel ) {
            this.setVisible( true );
            this.applyLauncherPosition( this.settings.settingsLauncherPosition || this.getDefaultLauncherPosition() );
            if ( openPanel === false )
                return;
            this.openPanel();
        }
        , hideLauncher: function() {
            this.setVisible( false );
        }
        , toggleLauncher: function() {
            if ( this.visible )
                this.hideLauncher();
            else
                this.showLauncher( true );
        }
        , openPanel: function() {
            this.showLauncher( false );
            this.positionPanel();
            this.$panel.addClass('open');
        }
        , closePanel: function() {
            this.$panel.removeClass('open');
        }
        , toggleClick: function( ev ) {
            ev.preventDefault();
            ev.stopPropagation();

            if ( this._suppressToggleClick ) {
                this._suppressToggleClick = false;
                return;
            }

            if ( this.$panel.hasClass('open') )
                this.closePanel();
            else
                this.openPanel();
        }
        , toggleMouseDown: function( ev ) {
            if ( ev.which != 1 )
                return;

            ev.preventDefault();
            ev.stopPropagation();

            this._dragState = {
                startX: ev.clientX
                , startY: ev.clientY
                , origin: $.extend( {}, this.settings.settingsLauncherPosition || this.getDefaultLauncherPosition() )
                , dragging: false
            };

            this._dragMove = this.handleDragMove.bind(this);
            this._dragUp = this.handleDragUp.bind(this);

            $(document)
                .on( 'mousemove', this._dragMove )
                .on( 'mouseup', this._dragUp );
        }
        , handleDragMove: function( ev ) {
            if ( !this._dragState )
                return;

            var nextLeft = this._dragState.origin.left + ( ev.clientX - this._dragState.startX )
                , nextTop = this._dragState.origin.top + ( ev.clientY - this._dragState.startY );

            if (
                !this._dragState.dragging
                && ( Math.abs( ev.clientX - this._dragState.startX ) > 3 || Math.abs( ev.clientY - this._dragState.startY ) > 3 )
            )
                this._dragState.dragging = true;

            if ( this._dragState.dragging )
                this.applyLauncherPosition({
                    top: nextTop
                    , left: nextLeft
                });
        }
        , handleDragUp: function() {
            $(document)
                .off( 'mousemove', this._dragMove )
                .off( 'mouseup', this._dragUp );

            if ( this._dragState && this._dragState.dragging ) {
                this._suppressToggleClick = true;
                this.persistSetting( 'settingsLauncherPosition', this.settings.settingsLauncherPosition );
            }

            delete this._dragMove;
            delete this._dragUp;
            delete this._dragState;
        }
        , handleDocumentPointerDown: function( ev ) {
            if ( !this.visible )
                return;

            if ( $(ev.target).closest('.guideLinr-settings-root').length )
                return;

            this.closePanel();
            this.$help.removeClass('open');
        }
        , handleWindowResize: function() {
            this.applyLauncherPosition( this.settings.settingsLauncherPosition || this.getDefaultLauncherPosition() );
        }
        , handleDeleteModeChanged: function( ev, isActive ) {
            this.renderDeleteModeState();
            if ( isActive ) {
                this.closePanel();
                this.$help.removeClass('open');
            }
        }
        , handleStorageChanged: function( changes, areaName ) {
            if ( areaName != 'local' )
                return;

            var nextSettings = {};
            $.each( defaultSettings, function( key ) {
                if ( changes[key] )
                    nextSettings[key] = changes[key].newValue;
            });

            if ( Object.keys( nextSettings ).length )
                this.applySettings( nextSettings );
        }
    }).init();

    var keyboardShortcuts = ({
        init: function() {
            this._onKeyDown = this.onKeyDown.bind(this);
            $(document).on( 'keydown', this._onKeyDown );
            return this;
        }
        , isTypingTarget: function( target ) {
            var $target = $(target);
            return $target.is('input, textarea, select') || !!$target.prop('isContentEditable') || $target.closest('[contenteditable=\"true\"]').length;
        }
        , matches: function( ev, key ) {
            return ev.altKey && ev.shiftKey && !ev.ctrlKey && !ev.metaKey && String.fromCharCode(ev.which || ev.keyCode).toUpperCase() == key;
        }
        , onKeyDown: function( ev ) {
            if ( this.isTypingTarget( ev.target ) )
                return;

            if ( this.matches( ev, 'I' ) ) {
                ev.preventDefault();
                return clearGuidesByDirection( 'vert' );
            }

            if ( this.matches( ev, 'L' ) ) {
                ev.preventDefault();
                return clearGuidesByDirection( 'horz' );
            }

            if ( this.matches( ev, 'D' ) ) {
                ev.preventDefault();
                deleteMode.toggle();
                return settingsUi.renderDeleteModeState();
            }
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
                clearGuidesByDirection();
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
            , toggleSettingsPanel: function() {
                settingsUi.toggleLauncher();
            }
            , clearVerticalGuides: function() {
                clearGuidesByDirection( 'vert' );
            }
            , clearHorizontalGuides: function() {
                clearGuidesByDirection( 'horz' );
            }
            , toggleDeleteMode: function() {
                deleteMode.toggle();
                settingsUi.renderDeleteModeState();
                return {
                    deleteModeActive: deleteMode.isActive()
                };
            }
            , getUiState: function() {
                return {
                    deleteModeActive: deleteMode.isActive()
                };
            }
        };
        
        var response = methods[request.method] ? methods[request.method]() : {};
        sendResponse(response || {}); // cause success callback
    });
})();
