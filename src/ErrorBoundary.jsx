import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, extra: null };
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    // Also log to console for good measure
    // eslint-disable-next-line no-console
    console.error("MMET ErrorBoundary caught:", error, info);
  }

  componentDidMount() {
    // Catch errors that happen outside React render (module init, async, etc.)
    this._onError = (event) => {
      const err = event?.error || new Error(event?.message || "window.onerror");
      this.setState({ error: err, info: { componentStack: "window.onerror" }, extra: event?.message });
    };

    this._onRejection = (event) => {
      const reason = event?.reason;
      const err =
        reason instanceof Error ? reason : new Error(typeof reason === "string" ? reason : JSON.stringify(reason));
      this.setState({ error: err, info: { componentStack: "unhandledrejection" }, extra: "Promise rejection" });
    };

    window.addEventListener("error", this._onError);
    window.addEventListener("unhandledrejection", this._onRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this._onError);
    window.removeEventListener("unhandledrejection", this._onRejection);
  }

  render() {
    const { error, info, extra } = this.state;

    if (!error) return this.props.children;

    const msg = error?.message || String(error);
    const stack = error?.stack || "(no stack)";

    return (
      <div style={{ padding: 16, fontFamily: "system-ui", background: "#fff" }}>
        <h2 style={{ margin: "0 0 8px 0" }}>MMET crashed — here’s the real error</h2>

        <div style={{ marginBottom: 10, padding: 10, border: "1px solid #f3c", background: "#fff6fb" }}>
          <div style={{ fontWeight: 700 }}>Message</div>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{msg}</pre>
        </div>

        <div style={{ marginBottom: 10, padding: 10, border: "1px solid #ddd", background: "#fafafa" }}>
          <div style={{ fontWeight: 700 }}>Stack</div>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{stack}</pre>
        </div>

        <div style={{ marginBottom: 10, padding: 10, border: "1px solid #ddd", background: "#fafafa" }}>
          <div style={{ fontWeight: 700 }}>React component stack</div>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
            {info?.componentStack || "(none)"}
          </pre>
        </div>

        {extra ? (
          <div style={{ marginBottom: 10, padding: 10, border: "1px solid #ddd", background: "#fafafa" }}>
            <div style={{ fontWeight: 700 }}>Extra</div>
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{String(extra)}</pre>
          </div>
        ) : null}

        <div style={{ fontSize: 12, color: "#444" }}>
          Common causes: default-vs-named export mismatch, missing file import, or a component throwing during render.
        </div>
      </div>
    );
  }
}
