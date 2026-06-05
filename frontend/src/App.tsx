import { useCall } from "./hooks/useCall";
import "./App.css";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function App() {
  const { status, duration, startCall, stopCall } = useCall();

  return (
    <div className="app">
      <div className="status-text">
        {status === "idle" && "点击按钮开始通话"}
        {status === "connecting" && "连接中..."}
        {status === "connected" && `通话中 ${formatDuration(duration)}`}
      </div>

      <button
        className={`call-button ${status === "connected" ? "hangup" : ""}`}
        onClick={status === "connected" ? stopCall : startCall}
        disabled={status === "connecting"}
      >
        {status === "idle" && "开始通话"}
        {status === "connecting" && "连接中..."}
        {status === "connected" && "挂断"}
      </button>
    </div>
  );
}

export default App;
