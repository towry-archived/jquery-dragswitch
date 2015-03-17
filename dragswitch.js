/*! 
 * jQuery plugin that drag switch elements
 * 
 * @copyright 2015 Towry Wang <http://towry.me>
 * @license MIT <http://towry.me/mit-license>
 */

;(function ($) {

  /**
   * Entry point
   * 
   * @param {function} [fn] Function to call to return api
   */
  $.fn.dragswitch = function (fn) {
    if (typeof fn !== 'function') {
      throw new Error("Argument is not a function");
    }

    return dragswitch(this, fn);
  }

  $.fn.dragswitch.defaults = {
    handle: '',
    between: false,
  }

  /**
   * Function to start
   * 
   * @param {Object} jqr jQuery object
   * @param {function} [fn] A callback
   */
  function dragswitch (jqr, fn) {
    fn = fn || function () {};

    // if nothing is selected, just return;
    if (!jqr.length) return jqr;

    Dragswitch(jqr, fn);

    return jqr;
  }

  /**
   * @type {array}
   * @const
   */
  var csses = 'display block float none marginTop 0px marginLeft 0px marginRight 0px marginBottom 0px paddingLeft 0px paddingTop 0px paddingRight 0px paddingBottom 0px'.split(' ');

  /**
   * The dragswitch class
   *
   * @param {Object} jqr jQuery object
   * @param {function} [fn] A callback
   * @constructor
   */
  function Dragswitch (jqr, fn) {
    if (! (this instanceof Dragswitch)) {
      return new Dragswitch(jqr, fn);
    }

    this.jqr_ = jqr;
    this.fn_ = fn;
    this.dragEndCallbacks = [];
    this.dragStartCallbacks = [];
    this.placeholderCallback = null;

    this.containers = [];
    this.container = null;
    this.containerInfo = null;
    this.containerOut = true;
    this.itemOut = true;

    // the drag item
    this.draggy = null;

    // cache stuff
    this.doc = $(document);

    this.drop = true;
    this.moveStarted = false;

    this.config = $.fn.dragswitch.defaults;

    this.runCallback();
  }

   /**
    * Run the callback passed to constructor
    */
   Dragswitch.prototype.runCallback = function () {
     var callback = this.fn_;
     var thisRaf = this;

     callback.call(thisRaf, this.apiBuilderCallback());
   }

   /**
    * Callback to build the api
    *
    * @return {function}
    */
   Dragswitch.prototype.apiBuilderCallback = function () {
     var self = this;

     return function (selectors) {
       selectors = selectors || 'div';

       if (typeof selectors === 'string') {
         selectors = [selectors];
       }

       var contextSelector = self.jqr_.selector;
       var _selectors = [];

       if (contextSelector) {
         contextSelector = contextSelector.split(',');
       }

       if (selectors.length >= contextSelector.length) {
         $.each(contextSelector, function (i, m) {
           _selectors.push([m, selectors[i]]);
         })
       } 

       // if container selector is more than drag item selector
       // we must ensure each container selector has a drag item
       // selector
       else if (selectors.length < contextSelector.length) {
         var b = selectors.length;

         $.each(contextSelector, function (i, m) {
           if (i >= b) {
             _selectors.push([m, selectors[b-1]]);
           }

           else {
             _selectors.push([m, selectors[i]]);
           }
         })
       }

       // start drag
       setTimeout(function () {
         self.startDrag(_selectors);
       }, 0);

       return {
          dragEnd: function (fn) { if (typeof fn === 'function') { self.dragEndCallbacks.push(fn); } return this; },
          dragStart: function (fn) { if (typeof fn === 'function') { self.dragStartCallbacks.push(fn); } return this; },
          config: function (options) { 
            self.config = $.extend({}, $.fn.dragswitch.defaults, options);
            return this; 
          },
          placeholder: function (fn) { if (typeof fn === 'function') { self.placeholderCallback = fn; } return this; }
        }
     };
   }

   /**
    * Start drag items
    *
    * @param {string} selectors The selectors
    */
   Dragswitch.prototype.startDrag = function (selectors) {
     var length = selectors.length;
     var jqr = this.jqr_;
     var self = this;
     var selector;

     // The jqr object contains the `containers`
     // for each the containers and bind the event
     jqr.each(function (i, j) {
       // filter the children of current container
       j = $(j);

       $.each(selectors, function (i, m) {
         if (j.is(m[0])) {
           selector = m[1];
           return false;
         }
       })

       if (!selector) {
         selector = 'div';
       }

       var childs = j.children().filter(selector);

       // style childs
       childs.css('cursor', 'pointer');
       
       self.addContainer(j, childs);
     })

     if (self.containers.length <= 1) {
       self.config.between = false;
     }

     self.doc.on('mousedown', function (e) {
       if (e.which != 1) {
         return;
       }

       if (!self.drop) return;
       // after bubble, no container is found.
       if (!self.container) return;
      
       var target = $(e.target);

       if (self.isDragItem(target)) {
         self.draggy = target;

         self.initDraggy();
         self.doc.on('mousemove', self.bindMouseMoveHandler());
         self.doc.on('mouseup', self.containerMouseUpHandler());
       }
     });
   }

   /**
    * Add container
    *
    * @param {Object} container The jquery object
    * @param {Object[]} childs Selected childrens
    */
   Dragswitch.prototype.addContainer = function (container, childs) {
     var o, f;

     o = container.offset();

     f = {
       dom: container,
       offset: {
         left: o.left,
         top: o.top,
         right: o.left + container.width(),
         bottom: o.top + container.height()
       },
       child: childs,
       table: [],
       placeholderIndex: -1
     };
     this.containers.push(f);

     this.buildTableForContainer(f, childs);
     this.bindEventsForContainer(f);
   }

   /**
    * Mouseout handler for container
    * @type {function}
    * @private
    */
   var _mouseOutHandler;

   /**
    * Mouse move start handler
    * @type {function}
    * @private
    */
   var _mouseMoveStartHandler;

   /**
    * Mouse move handler
    * @type {function}
    * @private
    */
   var _mouseMoveHandler;

   /**
    * Mouse up handler 
    * @type {function}
    * @private
    */
   var _containerMouseUpHandler;

   /** 
    * Mouse move handler
    */
   Dragswitch.prototype.mouseMoveHandler = function () {
     var self = this;

     _mouseMoveHandler = _mouseMoveHandler || function (e) {
       if (self.drop) return;

       if (self.config.between) {
          self.mouseOverWhichContainer(e);
       }

       self.mouseOverWhichItem(e);

       self.draggy && self.draggy.css({
         'left': self.dragPos.left + e.clientX - self.x_ + 'px',
         'top': self.dragPos.top + e.clientY - self.y_ + 'px'
       });
     }

     return _mouseMoveHandler;
   }

   /**
    * When the mouse is moving, check if it's over a container
    * @param {Object} e The jquery event data
    */
   Dragswitch.prototype.mouseOverWhichContainer = function (e) {
     // optimise: add mouseenter event to the container
     // when the drag item is it's child

     var a;
     var f = true;

     for (var i = 0, ii = this.containers.length; i < ii; i++) {
       a = this.containers[i];

       if (e.pageX >= a.offset.left && e.pageX <= a.offset.right) {
         if (e.pageY >= a.offset.top && e.pageY <= a.offset.bottom) {
           // the initial value of containerOut is false when
           // mousedown, but after one loop of the for, the 'container'
           // has set to null
           if (this.containerOut) {
             // before the container is changed
             // update the last container info
             if (!this.container.is(a.dom)) {
               // place the placeholder in the last
               if (this.containerInfo.child.length) {
                 this.containerInfo.placeholder.remove();
                 this.container.append(this.containerInfo.placeholder);
                 this.containerInfo.placeholderIndex = this.containerInfo.child.length - 1;
               }
               // remove draggy from the child of that container
               this.updateContainerInfo(false);
               this.draggyIndex = -1;
              }

             // container enter event here
           } 

           this.container = a.dom;
           this.containerInfo = a;
           this.containerOut = false;

           f = true;
           break;
         }
       }

       // this.container = null;
       f = false;
     }

     if (!f) {
       if (this.containerOut === false) {
         // trigger [cotainerout] event here.
         // this.updateContainerInfo();
       }

       this.containerOut = true;
     }
   }

   /** 
    * Check if the drag item is over something
    */
   Dragswitch.prototype.mouseOverWhichItem = function (e) {
     if (this.containerOut) return;

     var a = this.container;
     var b = this.containerInfo;
     var table = b.table;

     var d;
     // nothing found
     var f = false;

     for (var i = 0, ii = table.length; i < ii; i++) {
       d = table[i];

       if (e.pageX >= d.offset.left && e.pageX <= d.offset.right) {
         if (e.pageY >= d.offset.top && e.pageY <= d.offset.bottom) {
           if (d.dom.is(this.draggy)) return;

           if (this.itemOut) {
             // trigger item over event
             this.ajustPlaceholderPosition(d);
           }

           f = true;
           this.itemOut = false;
           break;
         }
       }

       f = false;
     }
    
     // nothing found ?
     if (!f) {
       this.itemOut = true;
     }
   }

   /**
    * Ajust the placeholder position
    * @param {Object} a The object that drag item is over
    */
   Dragswitch.prototype.ajustPlaceholderPosition = function (a) {
     var t = this.containerInfo.placeholder;
     var after;

     // if placeholder is after `a.dom`
     // move placeholder before `a.dom`
     if (this.containerInfo.placeholderIndex > a.index) {
       a.dom.before(t);
     }
     else {
       a.dom.after(t);
     }

     this.containerInfo.placeholderIndex = a.index;
     this.updateContainerInfo();
   }

   /**
    * Update the containerInfo
    * @param {boolean} add Add draggy to the container or not
    */
   Dragswitch.prototype.updateContainerInfo = function (add) {
     var a = this.containerInfo;
     var b = this.container;
     add = isNaN(add+1) ? true : add;

     // update the offset
     var c = b.offset();
     a.offset = {
       left: c.left,
       top: c.top,
       right: c.left + b.width(),
       bottom: c.top + b.height()
     }

     // update the child
     if (this.draggyIndex !== -1) {
       a.child.splice(this.draggyIndex, 1);
     }

     if (add) {
       a.child.splice(this.containerInfo.placeholderIndex, 0, this.draggy.get(0));
       this.draggyIndex = this.containerInfo.placeholderIndex;
     }

     // update the table
     var dom, offset;
     a.table = [];

     for (var i = 0, ii = a.child.length; i < ii; i++) {
       dom = $(a.child[i]);

       if (dom.is(this.draggy)) {
         // use placeholder offset
         offset = a.placeholder.offset();
       } else {
         offset = dom.offset();
       }

       a.table.push({
         dom: dom,
         index: i,
         offset: {
           left: offset.left,
           top:  offset.top,
           right: offset.left + dom.width(),
           bottom: offset.top + dom.height()
         }
       })
     }
   }

   /**
    * Bind event for a container
    *
    * @param {Object} a The object that contains container
    */
   Dragswitch.prototype.bindEventsForContainer = function (a) {
     var b, self = this;

     b = a.dom;

     _mouseOutHandler = _mouseOutHandler || function (e) {
       if (!self.draggy) return;

       if (self.config.between) {
         self.containerOut = true;
         self.mouseOverWhichContainer(e);
       }
     }

     b.on('mouseout', _mouseOutHandler);

     b.on('mousedown', function (e) {
       e.preventDefault();

       self.containerOut = false;
       self.container = b;
       self.containerInfo = self.getContainerInfo(b);
     });
   }

   /**
    * Handler triggered when mouseup
    */
   Dragswitch.prototype.containerMouseUpHandler = function () {
     var self = this;

     _containerMouseUpHandler = _containerMouseUpHandler || function (e) {
        self.doc.off('mouseup', _containerMouseUpHandler);
        self.drop = true;
        self.removeMouseMoveHandler();
        if (self.moveStarted) {
          self.updateContainerInfo();
          self.dropDraggy();
          self.clearPlaceholder();
          self.restoreDragStyle();

          if (self.config.between) {
            self.updateEachContainer();
          }

          self.draggy = null;
          self.draggyIndex = null;
        }
        self.moveStarted = false;

        // drag end
        for (var i = 0, ii = self.dragEndCallbacks.length, cb; i < ii; i++) {
          cb = self.dragEndCallbacks[i];

          // same as drag start, wait for add arguments
          cb.call(null);
        }
     }

     return _containerMouseUpHandler;
   }

   /**
    * Resotore drag item original style
    */
   Dragswitch.prototype.restoreDragStyle = function () {
     var t = this.draggy;

     t.removeAttr('style');
     if (t.attr('data-orisyl')) {
       t.attr('style', t.attr('data-orisyl')).removeAttr('data-orisyl');
     }
   }

   /**
    * Init the draggy object
    */
   Dragswitch.prototype.initDraggy = function () {
     var draggy = this.draggy;

     if (draggy.attr('style')) {
       draggy.attr('data-orisyl', draggy.attr('style'));
     }
   }

   /**
    * Bind the mouse move handler
    */
   Dragswitch.prototype.bindMouseMoveHandler = function () {
     var self = this;

     _mouseMoveStartHandler = _mouseMoveStartHandler || function (e) {
       e.stopPropagation();

       self.doc.off('mousemove', _mouseMoveStartHandler);
       self.doc.on('mousemove', self.mouseMoveHandler());

       self.drop = false;
       self.moveStarted = true;
       self.dragPos = getPosition(self.draggy);
       self.createPlaceholder();
       self.setDragItemPosition();
       self.draggy.css('cursor', 'move');
       self.draggy.css('opacity', '.6');

       // update each containers, this neccessary
       // must be updated after create placeholder :).
       // !!!
       // the container may have paddings and margins,
       // but we are not take that into account.
       if (self.config.between) {
         self.updateEachContainer();
       }

       // drag start
       for (var i = 0, ii = self.dragStartCallbacks.length, cb; i < ii; i++) {
         cb = self.dragStartCallbacks[i];

         // wait for add arguments
         cb.call(null);
       }

       self.x_ = e.clientX;
       self.y_ = e.clientY;
     }

     return _mouseMoveStartHandler;
   }

   /**
    * Update each container
    */
   Dragswitch.prototype.updateEachContainer = function () {
     var cur, offset, child, table;

     for (var i = 0, ii = this.containers.length; i < ii; i++) {
       cur = this.containers[i];
       offset = cur.dom.offset();
       cur.offset = {
         left: offset.left,
         top: offset.top,
         right: offset.left + cur.dom.width(),
         bottom: offset.top + cur.dom.height()
       }

       // since the container's position is moved
       // update table of it's child
       table = cur.table;

       for (var j = 0, jj = table.length; j < jj; j++) {
         cur = table[j];
         
         if (cur.dom.is(this.draggy)) continue;

         offset = cur.dom.offset();
         cur.offset = {
           left: offset.left,
           top: offset.top,
           right: offset.left + cur.dom.width(),
           bottom: offset.top + cur.dom.height()
         }
       }
     }
   }

   /**
    * Create placeholder
    */
   Dragswitch.prototype.createPlaceholder = function () {
     var t, c;

     if (this.containerInfo.placeholder) {
       t = this.containerInfo.placeholder;
     } else {
       t = document.createElement(this.draggy.prop('tagName'));
       t = $(t);

       this.containerInfo.placeholder = t;
     }

     this.containerInfo.placeholderIndex = this.draggyIndex;

     this.stylePlaceholder();
     // place the placeholder
     this.placeholderSetup(); 
   }

   /**
    * Drop the draggy
    */
   Dragswitch.prototype.dropDraggy = function () {
     // drop the draggy
     // if (detached(this.containerInfo.placeholder)) {
     //   throw new Error("What the ?");
     // }
     this.containerInfo.placeholder.before(this.draggy);

     // update container
     this.updateContainerInfo();
   }

   /**
    * Clear all placeholder
    */
   Dragswitch.prototype.clearPlaceholder = function () {
     var t;

     if (!this.config.between) {
       t = this.containerInfo.placeholder;
       if (t) t.remove();

       return;
     }

     for (var i = 0, ii = this.containers.length; i < ii; i++) {
       t = this.containers[i].placeholder;

       if (t) {
         t.remove();
       }
     }
   }

   /**
    * Setup placeholders
    */
   Dragswitch.prototype.placeholderSetup = function () {
     var c, p, t;

     t = this.containerInfo.placeholder;
     if (!this.config.between) {
       this.draggy.before(t);
       return;
     }

     for (var i = 0, ii = this.containers.length; i < ii; i++) {
       c = this.containers[i];
       if (this.container.is(c.dom)) continue;
       p = t.clone();
       c.dom.append(p);
       c.placeholder = p;
       c.placeholderIndex = c.child.length;
     }

     // insert placeholder before drag item
     // let the drag item off the flow
     this.draggy.before(t);
   }

   /**
    * Style the placeholders
    */
   Dragswitch.prototype.stylePlaceholder = function () {
     var t = this.containerInfo.placeholder;
     var a = this.draggy;

     for (var i = 0, ii = csses.length; i < ii; i += 2) {
       if (a.css(csses[i]) === '' || a.css(csses[i]) === csses[i+1]) continue;
       
       t.css(csses[i], a.css(csses[i]));
     }

     // default style of the placeholder
     t.css('border', '1px dashed #672c4f');
     t.css('width', a.css('width'));
     t.css('height', a.css('height'));

     // avoid p element 
     if (! a.is('div')) {
       a.css({
         'width': a.css('width'),
         'height': a.css('height')
       })
     }

     if (this.placeholderCallback) {
       this.placeholderCallback.call(null, t);
     }
   }

   /**
    * Set original position of the drag item
    */
   Dragswitch.prototype.setDragItemPosition = function () {
     if (!this.draggy) return;

     var p = getPosition(this.draggy);

     this.draggy.css({
       'left': p.left + 'px',
       'top': p.top + 'px',
       'position': 'absolute'
     })
   }

   /** 
    * Remove the mouse move handler
    */
   Dragswitch.prototype.removeMouseMoveHandler = function () {
     this.doc.off('mousemove', _mouseMoveHandler);
     this.doc.off('mousemove', _mouseMoveStartHandler);
   }

   /**
    * Test if the given object is a draggable item
    *
    * @param {Object} a A jquery object
    */
   Dragswitch.prototype.isDragItem = function (a) {
     var info = this.containerInfo;

     this.draggyIndex = info.child.index(a);

     return this.draggyIndex !== -1;
   }

   /**
    * Get the info of a container
    *
    * @param {Object} a The container
    */
   Dragswitch.prototype.getContainerInfo = function (a) {
     for (var i = 0, ii = this.containers.length; i < ii; i++) {
       if (this.containers[i].dom.is(a)) {
         return this.containers[i];
       }
     }
   }

   /**
    * Build coords for container
    *
    * @param {Object} a The object contains container
    * @param {Object[]} b The childs of the container
    */
   Dragswitch.prototype.buildTableForContainer = function (a, b) {
     var t = a.table, o;

     b.each(function (i, e) {
       e = $(e);
       o = e.offset();

       t.push({
         dom: e,
         index: i,
         offset: {
           left: o.left,
           top: o.top,
           right: o.left + e.width(),
           bottom: o.top + e.height()
         }
       })
     })
   }

   /**
    * Get position of a jquery object
    * @param {Object} a The jquery object
    */
   function getPosition (a) {
     var top, left;

     if (a.css('position') === 'relative') {
       left = (parseInt(a.css('left'), 10) || 0);
       top = (parseInt(a.css('top'), 10) || 0); 
     } else {
       var pos = a.offset();
       var margs = getMargins(a);

       left = pos.left - margs.left;
       top = pos.top - margs.top;
     }

     return {
       left: left,
       top: top
     }
   }

   /**
    * Get margins of a jquery object
    * @param {Object} a The jquery object
    */
   function getMargins (a) {
     return {
       left: (parseInt(a.css('marginLeft'), 10) || 0),
       top: (parseInt(a.css('marginTop'), 10) || 0)
     }
   }

   /**
    * Check if element is detached
    */
   function detached (a) {
     if (a instanceof jQuery) {
       a = a.get(0);
     }

     return !jQuery.contains(document, a);
   }

}(jQuery));
