// Lesson reader route (F32): /learn/lesson/<lesson-id>. The screen is src/learn/LessonReader.tsx (tests render it with an id).
import { useLocalSearchParams } from 'expo-router';
import LessonReader from '../../../src/learn/LessonReader';

export default function LessonRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <LessonReader id={id ?? ''} />;
}
