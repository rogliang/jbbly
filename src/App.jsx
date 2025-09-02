import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import phrasePool from "./phrasePool.json";
import { supabase } from "./supabaseClient";

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


function getDailyPhrases(pool) {
  if (!Array.isArray(pool) || pool.length === 0) return [];

  const today = new Date();
  const seed =
    today.getUTCFullYear() * 10000 +
    (today.getUTCMonth() + 1) * 100 +
    today.getUTCDate();

  const rng = mulberry32(seed);

  // Shuffle deterministically
  const shuffled = [...pool].sort(() => rng() - 0.5);

  // Pick first 5
  return shuffled.slice(0, 5);
}

export default function App() {
  const [dailyPhrases] = useState(getDailyPhrases(phrasePool));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [guess, setGuess] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [finished, setFinished] = useState(false);
  const [wrongGuess, setWrongGuess] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
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

  // Fetch leaderboard + subscribe for realtime updates
  useEffect(() => {
    const fetchLeaderboard = async () => {
      let { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .order("time", { ascending: true })
        .limit(10);

      if (!error && data) setLeaderboard(data);
    };

    fetchLeaderboard();

    const subscription = supabase
      .channel("leaderboard-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leaderboard" },
        (payload) => {
          console.log("New score added:", payload.new);
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const saveScore = async (playerName, totalTime) => {
  const { error } = await supabase
    .from("leaderboard")
    .insert([{ name: playerName, time: totalTime }]);

  if (error) {
    console.error("❌ Error saving score:", error);
  } else {
    // Immediately refresh leaderboard
    let { data, error: fetchError } = await supabase
      .from("leaderboard")
      .select("*")
      .order("time", { ascending: true })
      .limit(10);

    if (!fetchError && data) {
      setLeaderboard(data);

      // Optional: highlight the player if they’re in top 10
      const isTop10 = data.some((entry) => entry.name === playerName && entry.time === totalTime);
      if (isTop10) {
        toast.success("🎉 You made the Top 10!");
      }
    }
  }
};



  const handleSubmit = async () => {
    if (!dailyPhrases[currentIndex]) return;
    const currentPhrase = dailyPhrases[currentIndex];
    if (guess.trim().toLowerCase() === currentPhrase.answer.toLowerCase()) {
      if (currentIndex === dailyPhrases.length - 1) {
        const finish = Date.now();
        setEndTime(finish);
        setFinished(true);
        const penalty = hintUsed ? 5000 : 0;
        const totalTime = (finish - startTime + penaltyTime + penalty) / 1000;
        await saveScore(name || "You", totalTime);
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
    toast.info(
      <div>
        <div>💡 Hint:</div>
        <div>{hint}</div>
      </div>
    );
  };

  const handleSkip = async () => {
    if (!dailyPhrases[currentIndex]) return;
    const answer = dailyPhrases[currentIndex].answer;

    setPenaltyTime(penaltyTime + 10000);
    setSkippedIndexes([...skippedIndexes, currentIndex]);

    setRevealedAnswer(answer);
    toast.warning(
      <div>
        <div>⏩ Skipped! +10s penalty</div>
        <div>
          Answer was: <strong>{answer}</strong>
        </div>
      </div>
    );

    setTimeout(async () => {
      if (currentIndex === dailyPhrases.length - 1) {
        const finish = Date.now();
        setEndTime(finish);
        setFinished(true);
        const penalty = hintUsed ? 5000 : 0;
        const totalTime = (finish - startTime + penaltyTime + penalty) / 1000;
        await saveScore(name || "You", totalTime);
        toast.error(`Game Over! Final time: ${totalTime.toFixed(1)}s`);
      } else {
        setCurrentIndex(currentIndex + 1);
        setGuess("");
        setRevealedAnswer(null);
      }
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter" && name.trim()) setGameStarted(true);
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
            {leaderboard.map((entry, i) => (
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
                let color = "bg-gray-300";
                if (idx < currentIndex && skippedIndexes.includes(idx)) {
                  color = "bg-red-500"; // skipped
                } else if (idx < currentIndex) {
                  color = "bg-green-500"; // solved
                } else if (idx === currentIndex) {
                  color = "bg-yellow-400"; // current
                }
                return (
                  <span
                    key={idx}
                    className={`w-4 h-4 rounded-full ${color}`}
                  />
                );
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
              <button
                onClick={handleSubmit}
                className="bg-blue-600 text-white rounded px-3 py-2"
              >
                Submit
              </button>
              <button
                onClick={handleHint}
                className="border rounded px-3 py-2"
              >
                Hint (+5s)
              </button>
              <button
                onClick={handleSkip}
                className="bg-yellow-500 text-white rounded px-3 py-2"
              >
                Skip (+10s)
              </button>
            </div>
            {revealedAnswer && (
              <p className="text-center text-red-600 font-semibold">
                Answer: {revealedAnswer}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col space-y-4 items-center">
            <h2 className="text-xl font-bold">🎉 Game Over</h2>
            <p>
              Total Time:{" "}
              {((endTime - startTime + penaltyTime) / 1000).toFixed(1)} seconds
            </p>
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
