import {
  type FeedbackInput,
  feedbackSchema,
  type feedbackTypes,
} from "@freestyle/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { getClient } from "@renderer/lib/api";
import { cn } from "@renderer/lib/utils";
import { Check, MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

const typeOptions = [
  { value: "general", label: "General" },
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
] as const;

export default function FeedbackPage(): React.JSX.Element {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FeedbackInput>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { message: "", type: "general", email: undefined },
  });

  const selectedType = watch("type");

  const onSubmit = async (data: FeedbackInput) => {
    setSending(true);
    try {
      const res = await getClient().api.feedback.$post({ json: data });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      setSent(true);
      reset();
      setTimeout(() => setSent(false), 3000);
    } catch {
      // error handled by form
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-muted-foreground mt-1">
          Share your thoughts, report bugs, or suggest features.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Type selector */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Type</span>
          <div className="flex gap-2">
            {typeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setValue(
                    "type",
                    option.value as (typeof feedbackTypes)[number],
                  )
                }
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  selectedType === option.value
                    ? "border-primary bg-accent text-accent-foreground font-medium"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message textarea */}
        <div className="space-y-2">
          <label htmlFor="feedback-message" className="text-sm font-medium">
            Message
          </label>
          <textarea
            id="feedback-message"
            {...register("message")}
            placeholder="Tell us what's on your mind..."
            rows={5}
            className={cn(
              "border-border bg-card text-foreground placeholder:text-muted-foreground w-full resize-none rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-1",
              errors.message
                ? "border-destructive focus:ring-destructive"
                : "focus:border-primary focus:ring-primary",
            )}
          />
          {errors.message && (
            <p className="text-destructive text-xs">{errors.message.message}</p>
          )}
        </div>

        {/* Email (optional) */}
        <div className="space-y-2">
          <label htmlFor="feedback-email" className="text-sm font-medium">
            Email{" "}
            <span className="text-muted-foreground font-normal">
              (optional, for follow-up)
            </span>
          </label>
          <input
            id="feedback-email"
            type="email"
            {...register("email")}
            placeholder="you@example.com"
            className={cn(
              "border-border bg-card text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-1",
              errors.email
                ? "border-destructive focus:ring-destructive"
                : "focus:border-primary focus:ring-primary",
            )}
          />
          {errors.email && (
            <p className="text-destructive text-xs">{errors.email.message}</p>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={sending}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
            sent
              ? "bg-primary/10 text-primary"
              : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
          )}
        >
          {sent ? (
            <>
              <Check size={16} />
              Sent! Thanks for your feedback.
            </>
          ) : sending ? (
            <>
              <MessageSquare size={16} className="animate-pulse" />
              Sending...
            </>
          ) : (
            <>
              <Send size={16} />
              Send Feedback
            </>
          )}
        </button>
      </form>
    </div>
  );
}
