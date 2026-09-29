// Invitation adaptation: opt legacy jQuery document touch handlers out of
// modern browsers' passive defaults so their preventDefault calls work.
(function ($) {
  ['touchstart', 'touchmove', 'touchend'].forEach(function (type) {
    $.event.special[type] = {
      setup: function (_, namespaces, handler) { this.addEventListener(type, handler, { passive: false }); },
      teardown: function (_, handler) { this.removeEventListener(type, handler, false); }
    };
  });
})(window.jQuery);
