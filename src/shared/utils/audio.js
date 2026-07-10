export const playSafeAudio = (path) => {
  try {
    const audio = new Audio(path);

    audio.play().catch((err) => {
      if (err.name !== "NotAllowedError") {
        console.error("Audio Error:", err);
      }
    });
  } catch (err) {
    console.error("Audio Setup Error:", err);
  }
};