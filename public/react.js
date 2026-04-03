(() => {
  const mountNode = document.getElementById('react-top-user');
  if (!mountNode || !window.React || !window.ReactDOM) return;

  const root = ReactDOM.createRoot(mountNode);

  function TopUserBar({ name, isVisible }) {
    if (!isVisible) return null;

    return React.createElement(
      "div",
      { className: "top-user-bar" },
      React.createElement("span", { className: "top-user-label" }, "User Name:"),
      React.createElement("span", { className: "top-user-name" }, name || "Guest")
    );
  }

  window.renderTopUserBar = function renderTopUserBar(name, isVisible) {
    root.render(React.createElement(TopUserBar, { name, isVisible }));
  };

  window.renderTopUserBar("", false);
})();
