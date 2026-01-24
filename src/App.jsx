// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMmetStore } from "./store/mmetStore";
import RatingControls from "./components/RatingControls";
import ProductCard from "./components/ProductCard";
import SessionLog from "./components/SessionLog";

export default function App() {
  const {
    products,
    addProductsFromText,
    addProductsFromFiles,
    clearAllProducts,
    removeProduct,
    renameProduct,
    setSortBy,
    sortBy,
    loadSampleProducts,
  } = useMmetStore((s) => ({
    products: s.products,
    addProductsFromText: s.addProductsFromText,
    addProductsFromFiles: s.addProductsFromFiles,
    clearAllProducts: s.clearAllProducts,
    removeProduct: s.removeProduct,
    renameProduct: s.renameProduct,
    setSortBy: s.setSortBy,
    sortBy: s.sortBy,
    loadSampleProducts: s.loadSampleProducts,
  }));

  // Local UI state
  const [pasteText, setPasteText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const resultsRef = useRef(null);

  const productCount = products?.length ?? 0;

  const sortedProducts = useMemo(() => {
    const list = Array.isArray(products) ? [...products] : [];
    if (!sortBy) return list;

    // Common sort keys you’ve used: "Energy", "Relax", "Sleep", etc.
    // We sort by the score field if present: product.mmet?.scores[sortBy]
    return list.sort((a, b) => {
      const aVal =
        (a?.mmet?.scores && typeof a.mmet.scores[sortBy] === "number"
          ? a.mmet.scores[sortBy]
          : 0) ?? 0;
      const bVal =
        (b?.mmet?.scores && typeof b.mmet.scores[sortBy] === "number"
          ? b.mmet.scores[sortBy]
          : 0) ?? 0;
      return bVal - aVal;
    });
  }, [products, sortBy]);

  function scrollToResults() {
    // Wait for DOM paint
    requestAnimationFrame(() => {
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  async function handleParsePaste() {
    setParseError("");
    const text = (pasteText || "").trim();
    if (!text) return;

    try {
      setIsParsing(true);
      await addProductsFromText(text);
      setPasteText("");
      scrollToResults();
    } catch (e) {
      setParseError(e?.message || "Failed to parse pasted text.");
    } finally {
      setIsParsing(false);
    }
  }

  async function handleFilesSelected(fileList) {
    setParseError("");
    const files = Array.from(fileList || []);
    if (!files.length) return;

    try {
      setIsParsing(true);
      await addProductsFromFiles(files);
      scrollToResults();
    } catch (e) {
      setParseError(e?.message || "Failed to parse uploaded file(s).");
    } finally {
      setIsParsing(false);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dt = e.dataTransfer;
    if (dt?.files?.length) {
      handleFilesSelected(dt.files);
    }
  }

  function handleRemoveProduct(id) {
    removeProduct(id);
  }

  // If store doesn’t expose sortBy yet, keep UI stable
  useEffect(() => {
    if (typeof sortBy === "undefined") {
      // no-op
    }
  }, [sortBy]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold leading-tight">MMET Predictor v2</h1>
            <p className="text-xs text-gray-600">
              Paste COA text or upload files → parse → score → rank → log sessions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              onClick={loadSampleProducts}
              type="button"
            >
              Load Sample Products
            </button>

            <button
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              onClick={clearAllProducts}
              type="button"
              disabled={!productCount}
              title={!productCount ? "No products to clear" : "Clear all products"}
            >
              Clear All Products
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Upload / Paste */}
        <section className="grid gap-4 md:grid-cols-2">
          {/* Paste */}
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Paste COA Text</h2>
              <span className="text-xs text-gray-500">
                Tip: paste multiple products back-to-back
              </span>
            </div>

            <textarea
              className="h-40 w-full rounded-xl border p-3 text-sm outline-none focus:ring"
              placeholder="Paste COA text here…"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                onClick={handleParsePaste}
                type="button"
                disabled={isParsing || !pasteText.trim()}
              >
                {isParsing ? "Parsing…" : "Parse COA(s) & Score"}
              </button>

              <button
                className="rounded-xl border px-4 py-2 text-sm hover:bg-gray-50"
                onClick={() => setPasteText("")}
                type="button"
              >
                Clear Paste
              </button>
            </div>

            {parseError ? (
              <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {parseError}
              </p>
            ) : null}
          </div>

          {/* Upload */}
          <div
            className={[
              "rounded-2xl border bg-white p-4 shadow-sm",
              dragActive ? "ring-2 ring-black" : "",
            ].join(" ")}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Upload COA Files</h2>
              <span className="text-xs text-gray-500">TXT supported now (PDF next)</span>
            </div>

            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="text-sm">
                Drag & drop COA files here, or choose files.
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Current build accepts text-based COAs. (We’ll add PDF safely after build is green.)
              </p>

              <div className="mt-4">
                <input
                  className="block w-full text-sm"
                  type="file"
                  multiple
                  accept=".txt,text/plain"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Sorting + Ratings */}
        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Rank Products</h2>
              <div className="text-xs text-gray-500">{productCount} product(s)</div>
            </div>

            {/* RatingControls is expected to call store.setSortBy */}
            <RatingControls
              sortBy={sortBy || ""}
              onSortChange={(key) => setSortBy(key)}
            />

            <p className="mt-3 text-xs text-gray-500">
              Click an effect button to sort by that score.
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold">Session Log</h2>
            <p className="mt-1 text-xs text-gray-500">
              This is the calibration loop. We’ll hook persistence/import-export next.
            </p>
            <div className="mt-3">
              <SessionLog />
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="mt-6" ref={resultsRef}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Products</h2>
          </div>

          {sortedProducts.length === 0 ? (
            <div className="rounded-2xl border bg-white p-6 text-sm text-gray-600 shadow-sm">
              No products yet. Load samples, paste COA text, or upload files.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sortedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  sortBy={sortBy}
                  onRemove={handleRemoveProduct}
                  onRename={renameProduct}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-gray-500">
          Build-first rule: keep Vercel green, then add PDF parsing + persistence.
        </div>
      </footer>
    </div>
  );
}
