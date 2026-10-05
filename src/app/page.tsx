import MusicQuiz from "@/components/music-quiz";
import { dayKey } from "@/lib/game";
export const dynamic = "force-dynamic";
export default function Home() {
  return <MusicQuiz initialDay={dayKey()} />;
}
