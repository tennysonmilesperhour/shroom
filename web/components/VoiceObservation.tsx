"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBatchObservation } from "@/app/(app)/batches/workflow-actions";
import { queueOfflineMutation } from "@/lib/offline-queue";
import { useToast } from "@/components/ToastProvider";

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

const TAGS = ["healthy", "dry", "metabolites", "slow", "pins", "harvest_ready", "contamination", "recheck"];

export default function VoiceObservation({ batchId }: { batchId: number }) {
  const [text, setText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [usedSpeech, setUsedSpeech] = useState(false);
  const [pending, startTransition] = useTransition();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const router = useRouter();
  const { push } = useToast();
  useEffect(() => {
    setSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => recognitionRef.current?.stop();
  }, []);

  function toggleTag(tag: string) {
    setTags((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]);
  }

  function listen() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join(" ");
      setUsedSpeech(true);
      setText(transcript);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
      push({ title: "Voice input unavailable", body: "You can still type the observation.", tone: "spore" });
    };
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function save() {
    const clean = text.trim();
    if (!clean) return;
    const kind = usedSpeech ? "voice" as const : "note" as const;
    if (!navigator.onLine) {
      try {
        queueOfflineMutation({ type: "batch_observation", batchId, transcript: clean, tags, kind });
        setText("");
        setTags([]);
        setUsedSpeech(false);
        push({ title: "Observation queued", body: "It will sync when connection returns.", tone: "spore" });
      } catch {
        push({ title: "Couldn’t queue observation", body: "Offline browser storage is unavailable.", tone: "ember" });
      }
      return;
    }
    startTransition(async () => {
      try {
        const result = await addBatchObservation(batchId, clean, tags, kind);
        push({ title: result.ok ? "Observation saved" : "Couldn’t save", body: result.message, tone: result.ok ? "moss" : "ember" });
        if (result.ok) {
          setText("");
          setTags([]);
          setUsedSpeech(false);
          router.refresh();
        }
      } catch {
        try {
          queueOfflineMutation({ type: "batch_observation", batchId, transcript: clean, tags, kind });
          setText("");
          setTags([]);
          setUsedSpeech(false);
          push({ title: "Connection lost · observation queued", tone: "spore" });
        } catch {
          push({ title: "Couldn’t save observation", body: "The connection and offline storage are unavailable.", tone: "ember" });
        }
      }
    });
  }

  return (
    <div className="voice-observation">
      <div className="voice-compose">
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="Say or type what you see…" />
        {supported && (
          <button type="button" className={`voice-button${listening ? " listening" : ""}`} onClick={listen} disabled={listening}>
            {listening ? "Listening…" : "🎙 Speak"}
          </button>
        )}
      </div>
      <div className="choice-chips compact">
        {TAGS.map((tag) => (
          <button type="button" className={`choice-chip${tags.includes(tag) ? " selected" : ""}`} aria-pressed={tags.includes(tag)} key={tag} onClick={() => toggleTag(tag)}>
            {tag.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      <button type="button" className="primary" onClick={save} disabled={pending || !text.trim()}>
        {pending ? "Saving…" : "Save observation"}
      </button>
    </div>
  );
}
