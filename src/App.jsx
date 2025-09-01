import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import phrasePool from "./phrasePool.json";

function getDailyPhrases(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const today = new Date();
  const seed = today.getFullYear() * 1000 + today.getMonth() * 100 + today.getDate();
  const phrases = [];
  for (let i = 0; i < 5; i++) {
    const index = (seed + i) % pool.length;
    phrases.push(pool[index]);
  }
  return phrases;
}

export default function App() {
  const [dailyPhrases] = useState(getDailyPhrases(phrasePool));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [finished, setFinished] = useState(false);
  const [wrongGuess, setWrongGuess] = useState(false);
  const [leaderboard, setLeaderboard] = useState([
    { name: "Alice", time: 42.1 },
    { name: "Bob", time: 55.4 }
  ]);
  const [name, setName] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [revealedAnswer, setRevealedAnswer] = useState(null);
  const [penaltyTime, setPenaltyTime] = useState(0);
  const [skippedIndexes, setSkippedIndexes] = useState([]);

  useEffect(() => {
    if (gameStarted && !startTime) setStartTime(Date.now());
    if (!gameStarted || finished) return;
    const interval = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(interval);
  }, [startTime, gameStarted, finished]);

  const handleSubmit = () => {
    if (!dailyPhrases[currentIndex]) return;
    const currentPhrase = dailyPhrases[currentIndex];
    if (guess.trim().toLowerCase() === currentPhrase.answer.toLowerCase()) {
      if (currentIndex === dailyPhrases.length - 1) {
        const finish = Date.now();
        setEndTime(finish);
        setFinished(true);
        const penalty = hintUsed ? 5000 : 0;
        const totalTime = (finish - startTime + penaltyTime + penalty) / 1000;
        setLeaderboard(
          [...leaderboard, { name: name || "You", time: totalTime }]
            .sort((a, b) => a.time - b.time)
            .slice(0, 10)
        );
        toast.success(`🎉 You finished in ${totalTime.toFixed(1)}s!`);
      } else {
        setCurrentIndex(currentIndex + 1);
        setGuess("");
        setRevealedAnswer(null);
        toast.success("✅ Correct! Moving to the next phrase...");
      }
    } else {
      setWrongGuess(true);
      setTimeout(() => setWrongGuess(false), 500);
    }
  };

  const handleHint = () => {
    if (!dailyPhrases[currentIndex]) return;
    setHintUsed(true);
    const answer = dailyPhrases[currentIndex].answer || "";
    const hint =
      dailyPhrases[currentIndex].hint ||
      (answer ? `Starts with "${answer.split(" ")[0]}"` : "No hint available");
    toast.info(`💡 Hint: ${hint}`);
  };

  const handleSkip = () => {
    if (!dailyPhrases[currentIndex]) return;
    const answer = dailyPhrases[currentIndex].answer;

    // Add 10s penalty
    setPenaltyTime(penaltyTime + 10000);

    // Mark skipped
    setSkippedIndexes([...skippedIndexes, currentIndex]);

    // Temporarily show skipped answer
    setRevealedAnswer(answer);
    toast.warning(
      <div>
        <div>⏩ Skipped! +10s penalty</div>
        <div>Answer was: <strong>{answer}</strong></div>
      </div>
    );

    setTimeout(() => {
      if (currentIndex === dailyPhrases.length - 1) {
        const finish = Date.now();
        setEndTime(finish);
        setFinished(true);
        const penalty = hintUsed ? 5000 : 0;
        const totalTime = (finish - startTime + penaltyTime + penalty) / 1000;
        setLeaderboard(
          [...leaderboard, { name: name || "You", time: totalTime }]
            .sort((a, b) => a.time - b.time)
            .slice(0, 10)
        );
        toast.error(`Game Over! Final time: ${totalTime.toFixed(1)}s`);
      } else {
        setCurrentIndex(currentIndex + 1);
        setGuess("");
        setRevealedAnswer(null);
      }
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter" && name.trim()) {
      setGameStarted(true);
    }
  };

  const elapsed =
    startTime && !finished
      ? (now - startTime + penaltyTime) / 1000
      : endTime
      ? (endTime - startTime + penaltyTime) / 1000
      : 0;

  if (!gameStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-md flex justify-center mb-6">
          <img src="/logo.png" alt="jbbly logo" className="h-12 mr-2" />
          <h1 className="text-3xl font-extrabold text-blue-600">
            jbbly<span className="text-orange-500">.co</span>
          </h1>
        </div>
        <div className="w-full max-w-md shadow-xl p-6 bg-white rounded-lg">
          <h1 className="text-xl font-bold text-center">Enter Your Name</h1>
          <input
            placeholder="Your name"
            className="border rounded px-3 py-2 w-full mt-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleNameKeyDown}
          />
          <button
            className="mt-4 w-full bg-blue-600 text-white rounded py-2 disabled:bg-gray-400"
            disabled={!name.trim()}
            onClick={() => setGameStarted(true)}
          >
            Start Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-100 p-6">
      <div className="w-full max-w-4xl flex justify-start mb-4 items-center">
        <img src="/logo.png" alt="jbbly logo" className="h-10 mr-2" />
        <h1 className="text-3xl font-extrabold text-blue-600">
          jbbly<span className="text-orange-500">.co</span>
        </h1>
      </div>

      <div className="flex justify-between w-full max-w-4xl mb-4">
        <span className="text-xl font-mono">⏱️ {elapsed.toFixed(1)}s</span>
        <div className="w-40">
          <h3 className="text-sm font-semibold mb-1">🏆 Top 10</h3>
          <ul className="text-xs">
            {leaderboard.slice(0, 10).map((entry, i) => (
              <li key={i} className="flex justify-between border-b py-0.5">
                <span>{entry.name}</span>
                <span>{entry.time.toFixed(1)}s</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="w-full max-w-lg shadow-xl p-6 bg-white rounded-lg">
        {!finished ? (
          <div className="flex flex-col space-y-4">
            <h1 className="text-2xl font-bold text-center">Guess the Phrase</h1>

            {/* Progress dots */}
            <div className="flex justify-center space-x-2">
              {dailyPhrases.map((_, idx) => {
                let color = "bg-gray-300"; // default upcoming
                if (idx < currentIndex && skippedIndexes.includes(idx)) {
                  color = "bg-red-500"; // skipped
                } else if (idx < currentIndex) {
                  color = "bg-green-500"; // solved
                } else if (idx === currentIndex) {
                  color = "bg-yellow-400"; // current
                }
                return <span key={idx} className={`w-4 h-4 rounded-full ${color}`} />;
              })}
            </div>

            {dailyPhrases[currentIndex] && (
              <p className="text-xl text-center text-gray-700">
                {dailyPhrases[currentIndex].gibberish}
              </p>
            )}
            <AnimatePresence>
              <motion.div
                key={wrongGuess ? "wrong" : "input"}
                initial={{ x: 0 }}
                animate={
                  wrongGuess
                    ? { x: [0, -10, 10, -10, 10, 0], backgroundColor: "#fecaca" }
                    : { x: 0, backgroundColor: "#fff" }
                }
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                <input
                  placeholder="Type your guess"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="border rounded px-3 py-2 w-full"
                />
              </motion.div>
            </AnimatePresence>
            <div className="flex space-x-2">
              <button onClick={handleSubmit} className="bg-blue-600 text-white rounded px-3 py-2">Submit</button>
              <button onClick={handleHint} className="border rounded px-3 py-2">Hint (+5s)</button>
              <button onClick={handleSkip} className="bg-yellow-500 text-white rounded px-3 py-2">Skip (+10s)</button>
            </div>
            {revealedAnswer && (
              <p className="text-center text-red-600 font-semibold">Answer: {revealedAnswer}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col space-y-4 items-center">
            <h2 className="text-xl font-bold">🎉 Game Over</h2>
            {revealedAnswer && (
              <p className="text-red-600 font-semibold">Answer: {revealedAnswer}</p>
            )}
            <p>Total Time: {((endTime - startTime + penaltyTime) / 1000).toFixed(1)} seconds</p>
            <h3 className="text-lg font-semibold">Leaderboard</h3>
            <ul className="w-full">
              {leaderboard.map((entry, i) => (
                <li
                  key={i}
                  className="flex justify-between border-b py-1 text-gray-800"
                >
                  <span>{entry.name}</span>
                  <span>{entry.time.toFixed(1)}s</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
