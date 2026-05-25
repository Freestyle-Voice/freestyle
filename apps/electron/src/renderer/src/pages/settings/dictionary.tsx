import {
  type CreateDictionaryInput,
  createDictionarySchema,
} from "@freestyle/validations";
import { zodResolver } from "@hookform/resolvers/zod";
import { getClient } from "@renderer/lib/api";
import { cn } from "@renderer/lib/utils";
import {
  Book,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

interface DictionaryEntry {
  id: number;
  key: string;
  value: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 20;

export default function DictionaryPage(): React.JSX.Element {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Add/edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset: resetFormValues,
    formState: { errors: formErrors },
  } = useForm<CreateDictionaryInput>({
    resolver: zodResolver(createDictionarySchema),
    defaultValues: { key: "", value: "" },
  });

  const loadData = useCallback(async () => {
    try {
      const query: Record<string, string> = {
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
        orderBy: "-created_at",
      };
      if (search) query.search = search;

      const res = await getClient().api.dictionary.$get({ query });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.items);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to load dictionary:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const resetForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
    resetFormValues({ key: "", value: "" });
  }, [resetFormValues]);

  const startEdit = useCallback(
    (entry: DictionaryEntry) => {
      setEditingId(entry.id);
      setFormError(null);
      resetFormValues({ key: entry.key, value: entry.value });
      setShowForm(true);
    },
    [resetFormValues],
  );

  const saveEntry = useCallback(
    async (data: CreateDictionaryInput) => {
      setFormError(null);

      try {
        const client = getClient();
        const res = editingId
          ? await client.api.dictionary[":id"].$put({
              param: { id: String(editingId) },
              json: data,
            })
          : await client.api.dictionary.$post({ json: data });

        if (!res.ok) {
          const err = await res.text().catch(() => "");
          setFormError(err || `HTTP ${res.status}`);
          return;
        }

        resetForm();
        loadData();
      } catch {
        setFormError("Failed to save entry.");
      }
    },
    [editingId, resetForm, loadData],
  );

  const deleteEntry = useCallback(
    async (id: number) => {
      await getClient().api.dictionary[":id"].$delete({
        param: { id: String(id) },
      });
      loadData();
    },
    [loadData],
  );

  const importRef = useRef<HTMLInputElement>(null);

  const exportJson = useCallback(async () => {
    try {
      const res = await getClient().api.dictionary.export.json.$get();
      if (!res.ok) return;
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dictionary.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, []);

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await getClient().api.dictionary.import.$post({ json: data });
        loadData();
      } catch {
        // ignore
      }
      // Reset input so same file can be re-imported
      if (importRef.current) importRef.current.value = "";
    },
    [loadData],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground text-sm">Loading dictionary...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dictionary</h1>
        <p className="text-muted-foreground mt-1">
          Define shortcuts that automatically expand in your transcriptions.
          When a key phrase is detected, it gets replaced with its value.
        </p>
      </div>

      {/* Search + Actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search dictionary..."
            className="border-border bg-card text-foreground w-full rounded-lg border py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={exportJson}
          className="border-border hover:bg-secondary rounded-lg border p-2"
          title="Export as JSON"
        >
          <Download size={16} className="text-muted-foreground" />
        </button>
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="border-border hover:bg-secondary rounded-lg border p-2"
          title="Import from JSON"
        >
          <Upload size={16} className="text-muted-foreground" />
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
        >
          <Plus size={16} />
          Add
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit(saveEntry)}
          className="border-border bg-card rounded-lg border p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {editingId ? "Edit Entry" : "New Entry"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label
                htmlFor="dict-key"
                className="text-muted-foreground mb-1 block text-xs"
              >
                Key (phrase to detect)
              </label>
              <input
                id="dict-key"
                type="text"
                {...register("key")}
                placeholder='e.g. "my address"'
                className={cn(
                  "border-border bg-background w-full rounded-lg border px-3 py-2 text-sm",
                  formErrors.key && "border-destructive",
                )}
              />
              {formErrors.key && (
                <p className="text-destructive mt-1 text-xs">
                  {formErrors.key.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="dict-value"
                className="text-muted-foreground mb-1 block text-xs"
              >
                Value (replacement text)
              </label>
              <textarea
                id="dict-value"
                {...register("value")}
                placeholder="e.g. 123 Main St, Springfield, IL 62701"
                rows={2}
                className={cn(
                  "border-border bg-background w-full resize-none rounded-lg border px-3 py-2 text-sm",
                  formErrors.value && "border-destructive",
                )}
              />
              {formErrors.value && (
                <p className="text-destructive mt-1 text-xs">
                  {formErrors.value.message}
                </p>
              )}
            </div>
            {formError && (
              <p className="text-destructive text-xs">{formError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="border-border hover:bg-secondary rounded-lg border px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-3 py-1.5 text-sm font-medium"
              >
                {editingId ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Entries list */}
      {entries.length === 0 && !search ? (
        <div className="border-border rounded-lg border border-dashed px-4 py-8 text-center">
          <Book className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            No dictionary entries yet. Add one to get started.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Example: key &quot;my address&quot; &rarr; value &quot;123 Main St,
            Springfield&quot;
          </p>
        </div>
      ) : entries.length === 0 && search ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No entries match &quot;{search}&quot;
        </p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border-border group rounded-lg border px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Book size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{entry.key}</span>
                    <span className="text-muted-foreground text-xs">
                      &rarr;
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
                    {entry.value}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {entry.usage_count > 0 && (
                  <span className="text-muted-foreground text-[10px]">
                    Used {entry.usage_count}{" "}
                    {entry.usage_count === 1 ? "time" : "times"}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => startEdit(entry)}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded px-2 py-1 text-xs"
                    title="Edit"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEntry(entry.id)}
                    className="text-muted-foreground hover:text-destructive flex items-center gap-1 rounded px-2 py-1 text-xs"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-muted-foreground text-xs">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className={cn(
                  "rounded p-1",
                  page === 0
                    ? "text-muted-foreground/40"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-muted-foreground px-2 text-xs">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className={cn(
                  "rounded p-1",
                  page >= totalPages - 1
                    ? "text-muted-foreground/40"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
