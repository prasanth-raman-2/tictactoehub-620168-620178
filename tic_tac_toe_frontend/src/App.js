import React, { useEffect, useState } from "react";
import "./App.css";

/*
  Tic Tac Toe React UI - Modern Minimal, Centered Layout, Status Top, Board Center, Actions Below.
  Colors (from backend description):
    Accent: #E64A19 (orange)
    Primary: #3949AB (blue)
    Secondary: #FBC02D (yellow)
*/

// === Helper Functions ===
const API_BASE = "http://localhost:3001";

async function api_call(endpoint, method = "GET", data = null) {
  const params = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (data) params.body = JSON.stringify(data);
  const res = await fetch(API_BASE + endpoint, params);
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  return res.json();
}

// === Main App ===
function App() {
  // Auth & Game State
  const [userId, setUserId] = useState(() => localStorage.getItem("ttt_user_id") || "");
  const [nickname, setNickname] = useState(() => localStorage.getItem("ttt_nickname") || "");
  const [authLoading, setAuthLoading] = useState(false);

  const [gameId, setGameId] = useState("");
  const [symbol, setSymbol] = useState(""); // 'X' or 'O'
  const [opponentNickname, setOpponentNickname] = useState("");
  const [gameList, setGameList] = useState([]);
  const [joinGameInput, setJoinGameInput] = useState("");

  const [board, setBoard] = useState([[null, null, null], [null, null, null], [null, null, null]]);
  const [turn, setTurn] = useState(null); // whose turn: 'X' or 'O'
  const [status, setStatus] = useState(""); // waiting/in-progress/win/draw
  const [winner, setWinner] = useState(null);
  const [winningPositions, setWinningPositions] = useState([]);
  const [gameMsg, setGameMsg] = useState("");
  const [loadingState, setLoadingState] = useState(false);

  // Theme (light only, but keep toggle for demo/future)
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Board polling interval (to update on opponent move)
  useEffect(() => {
    let poller;
    if (gameId && status === "in-progress") {
      poller = setInterval(refreshGameState, 2000);
    }
    return () => poller && clearInterval(poller);
    // eslint-disable-next-line
  }, [gameId, status]);

  // Load open games list if at lobby
  useEffect(() => {
    if (userId && !gameId) fetchOpenGames();
    // eslint-disable-next-line
  }, [userId]);

  // ---- Auth Handlers ----
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      const resp = await api_call("/auth", "POST", { nickname: nickname || null });
      setUserId(resp.user_id);
      setNickname(resp.nickname || "");
      localStorage.setItem("ttt_user_id", resp.user_id);
      if (resp.nickname) localStorage.setItem("ttt_nickname", resp.nickname);
    } catch (err) {
      setGameMsg("Authentication error: " + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ---- Game Flow ----
  const fetchOpenGames = async () => {
    try {
      const list = await api_call("/games");
      setGameList(list);
    } catch {
      setGameList([]);
    }
  };

  const handleCreateGame = async () => {
    setLoadingState(true);
    setGameMsg("");
    try {
      const resp = await api_call("/games", "POST", { user_id: userId });
      setGameId(resp.game_id);
      setSymbol("X");
      setOpponentNickname("");
      setStatus("waiting-for-opponent");
      setTurn("X");
      setBoard([[null, null, null], [null, null, null], [null, null, null]]);
      setWinner(null);
      setWinningPositions([]);
      setGameMsg("Game created. Waiting for opponent to join.");
    } catch (err) {
      setGameMsg("Could not create game: " + err.message);
    } finally {
      setLoadingState(false);
    }
  };

  const handleJoinGame = async (gid) => {
    const toJoin = gid || joinGameInput;
    setLoadingState(true);
    setGameMsg("");
    try {
      const resp = await api_call("/games/join", "POST", { game_id: toJoin, user_id: userId });
      setGameId(resp.game_id);
      setSymbol(resp.symbol);
      setBoard(resp.board);
      setOpponentNickname(resp.opponent_nickname || "");
      setStatus(resp.board.flat().filter(x => x).length === 0 ? "in-progress" : "in-progress");
      setGameMsg("");
      refreshGameState(resp.game_id, true);
    } catch (err) {
      setGameMsg("Join failed: " + err.message);
    } finally {
      setLoadingState(false);
    }
  };

  const refreshGameState = async (gid, skipMsg) => {
    const id = gid || gameId;
    if (!id) return;
    try {
      const resp = await api_call(`/games/${id}/state`);
      setBoard(resp.board);
      setTurn(resp.turn);
      setStatus(resp.status);
      setWinner(resp.winner);
      // Win/draw status message, skip on auto-poll unless game over.
      if (!skipMsg || ["win", "draw"].includes(resp.status)) {
        if (resp.status === "win") setGameMsg(`Game Over: ${resp.winner === symbol ? "You win!" : "You lose!"}`);
        else if (resp.status === "draw") setGameMsg("Game ended in a draw.");
        else if (resp.status === "in-progress") setGameMsg("");
      }
    } catch (err) {
      setGameMsg("Failed to refresh game: " + err.message);
    }
  };

  // Make move at (row,col)
  const handleMakeMove = async (row, col) => {
    if (board[row][col] != null || status !== "in-progress" || turn !== symbol) return;
    setLoadingState(true);
    setGameMsg("");
    try {
      const resp = await api_call("/games/move", "POST", {
        game_id: gameId, row, col, user_id: userId
      });
      setBoard(resp.board);
      setStatus(resp.status);
      setWinner(resp.winner);
      setWinningPositions(resp.winning_positions || []);
      if (resp.status === "win") setGameMsg("Game Over: " + (resp.winner === symbol ? "You win!" : "You lose!"));
      else if (resp.status === "draw") setGameMsg("Game ended in a draw.");
    } catch (err) {
      setGameMsg("Move failed: " + err.message);
    } finally {
      setLoadingState(false);
    }
  };

  // Leave game and return to lobby
  const leaveGame = () => {
    setGameId("");
    setSymbol("");
    setOpponentNickname("");
    setBoard([[null, null, null], [null, null, null], [null, null, null]]);
    setTurn(null);
    setStatus("");
    setWinner(null);
    setWinningPositions([]);
    setGameMsg("");
    fetchOpenGames();
  };

  // ---- UI Components ----

  // Modern Board rendering
  function Board({ board, onClick, winSquares }) {
    return (
      <div className="ttt-board">
        {board.map((row, rIdx) =>
          <div className="ttt-row" key={rIdx}>
            {row.map((cell, cIdx) =>
              <button
                data-testid={`cell-${rIdx}-${cIdx}`}
                className={
                  "ttt-cell"
                  + (cell === "X" ? " ttt-x" : cell === "O" ? " ttt-o" : "")
                  + (winSquares && winSquares.some(([r, c]) => r === rIdx && c === cIdx) ? " ttt-win" : "")
                }
                key={cIdx}
                onClick={() => onClick && onClick(rIdx, cIdx)}
                disabled={cell || status !== "in-progress" || turn !== symbol || loadingState}
                aria-label={`cell ${rIdx},${cIdx} contains ${cell || "empty"}`}
              >
                {cell}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Status message at the top
  function StatusMessage() {
    if (!userId) return <div className="ttt-status">Welcome! Enter a nickname to start.</div>;
    if (!gameId) return <div className="ttt-status">Lobby: Select or create a game.</div>;
    if (status === "waiting-for-opponent") return <div className="ttt-status">Waiting for opponent to join...</div>;
    if (status === "win" || status === "draw") return <div className="ttt-status ttt-gameover">{gameMsg}</div>;
    if (turn && symbol && status === "in-progress") {
      return (
        <div className="ttt-status">
          <b>{turn === symbol ? "Your move" : opponentNickname ? `${opponentNickname}'s move` : "Opponent's move"}</b>
          <span style={{ marginLeft: 8 }}>({turn === "X" ? "X" : "O"})</span>
        </div>
      );
    }
    return <div className="ttt-status">{gameMsg}</div>;
  }

  // Main Render
  return (
    <div className="App">
      <button
        className="theme-toggle"
        onClick={() => setTheme(prev => prev === "light" ? "dark" : "light")}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      >
        {theme === "light" ? "🌙 Dark" : "☀️ Light"}
      </button>
      <div className="ttt-container">
        <StatusMessage />
        {!userId && (
          <form className="ttt-auth-form" onSubmit={handleAuth}>
            <input
              type="text"
              placeholder="Enter nickname (optional)"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="ttt-input"
              spellCheck={false}
              disabled={authLoading}
              maxLength={16}
              aria-label="Nickname"
              style={{ marginTop: 36 }}
            />
            <button className="ttt-btn ttt-btn-primary" disabled={authLoading} style={{marginTop: 16}}>
              {authLoading ? "..." : "Start"}
            </button>
          </form>
        )}

        {userId && !gameId && (
          <div className="ttt-lobby">
            <button className="ttt-btn ttt-btn-accent" onClick={handleCreateGame} disabled={loadingState} style={{width:"100%",marginBottom:18}}>
              {loadingState ? "..." : "Create New Game"}
            </button>
            <div className="ttt-join-section">
              <input
                className="ttt-input"
                style={{width:"65%",marginRight:8}}
                type="text"
                placeholder="Enter Game ID"
                value={joinGameInput}
                onChange={e=>setJoinGameInput(e.target.value)}
                aria-label="Join game input"
                maxLength={36}
              />
              <button className="ttt-btn ttt-btn-secondary" disabled={!joinGameInput} onClick={() => handleJoinGame()} >Join</button>
            </div>
            <div className="ttt-game-list">
              <div className="ttt-lobby-title">Open Games</div>
              {gameList.length===0 && <div className="ttt-empty-list">No available games</div>}
              {gameList.map(g => (
                <div className="ttt-game-row" key={g.game_id}>
                  <span className="ttt-game-id">{g.game_id.slice(0,8)}</span>
                  <span className="ttt-player-x">{g.players.X || "?"} (X)</span>
                  {g.players.O ? (<span className="ttt-player-o">{g.players.O} (O)</span>) :
                    (<button className="ttt-btn ttt-btn-sm ttt-btn-join" onClick={()=>handleJoinGame(g.game_id)}
                      disabled={loadingState}
                    >Join</button>)}
                </div>
              ))}
            </div>
          </div>
        )}

        {userId && gameId && (
          <div className="ttt-gamebox">
            <div className="ttt-board-wrap">
              <Board board={board} onClick={handleMakeMove} winSquares={winningPositions} />
            </div>
            <div className="ttt-action-row">
              <button className="ttt-btn ttt-btn-outline" onClick={leaveGame} style={{marginRight:8}}>Leave Game</button>
              <span className="ttt-symbol-indicator">
                You are <b style={{color: symbol === 'X' ? "#3949AB" : "#FBC02D"}}>{symbol}</b>
                {opponentNickname ? ` | vs ${opponentNickname}`:""}
              </span>
            </div>
          </div>
        )}
      </div>
      <footer className="ttt-footer">
        <span>
          <a href="https://reactjs.org/" target="_blank" rel="noopener noreferrer" style={{color:"#3949AB"}}>React</a>
          &nbsp;•&nbsp;UI by KAVIA Template
        </span>
      </footer>
    </div>
  );
}

export default App;
