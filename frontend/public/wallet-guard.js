(function () {
  if (typeof window === "undefined") return;

  function isEthereumRedefineError(message) {
    return (
      typeof message === "string" &&
      message.indexOf("Cannot redefine property: ethereum") !== -1
    );
  }

  window.addEventListener(
    "error",
    function (event) {
      if (isEthereumRedefineError(event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  var defineProperty = Object.defineProperty;
  Object.defineProperty = function (target, property, descriptor) {
    if (property === "ethereum") {
      try {
        return defineProperty.call(this, target, property, descriptor);
      } catch (err) {
        return target;
      }
    }
    return defineProperty.call(this, target, property, descriptor);
  };
})();
