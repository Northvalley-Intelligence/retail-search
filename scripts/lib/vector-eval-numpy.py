import json, sys
import numpy as np

emb_path, pool_path, out_path, ignore_identical = sys.argv[1:5]
ignore_identical = ignore_identical == "true"
K, VDEPTH, RSIZE = 10, 100, 100

emb = json.load(open(emb_path))
pool = json.load(open(pool_path))
doc_ids = [str(d["id"]) for d in emb["documents"]]
D = np.array([d["embedding"] for d in emb["documents"]], dtype=np.float32)  # normalized
qvec = {str(q["id"]): np.array(q["embedding"], dtype=np.float32) for q in emb["queries"]}

def ndcg_at_k(ranked_ids, qrels, k=K):
    gains = [qrels.get(i, 0) for i in ranked_ids[:k]]
    dcg = sum((g)/np.log2(idx+2) for idx, g in enumerate(gains) if g > 0)
    ideal = sorted([g for g in qrels.values() if g > 0], reverse=True)[:k]
    idcg = sum((g)/np.log2(idx+2) for idx, g in enumerate(ideal))
    return dcg/idcg if idcg > 0 else 0.0

def minmax(scores):
    if not scores: return {}
    vals = list(scores.values()); lo, hi = min(vals), max(vals); rng = (hi-lo) or 1.0
    return {i: (s-lo)/rng for i, s in scores.items()}

def mean_ndcg(rankings_by_q):
    cases = pool["cases"]
    return round(float(np.mean([ndcg_at_k(rankings_by_q[c["queryId"]], {str(k): v for k, v in c["qrels"].items()}) for c in cases])), 4)

# Vector ranking (full corpus) per query
vec_rank = {}
for c in pool["cases"]:
    qid = str(c["queryId"]); qv = qvec.get(qid)
    if qv is None: vec_rank[qid] = []; continue
    sims = D @ qv
    order = np.argsort(-sims)
    ids = [doc_ids[i] for i in order[:VDEPTH + (1 if ignore_identical else 0)]]
    if ignore_identical: ids = [i for i in ids if i != qid]
    vec_rank[qid] = [(i, float(sims[doc_ids.index(i)])) for i in ids[:VDEPTH]]

lex_rank = {str(c["queryId"]): [(str(r["id"]), r["score"]) for r in c["results"]] for c in pool["cases"]}

runs = {}
runs["lexical-first-stage"] = mean_ndcg({q: [i for i, _ in rr] for q, rr in lex_rank.items()})
runs["vector-only"] = mean_ndcg({q: [i for i, _ in rr] for q, rr in vec_rank.items()})

def blend(lex, vec, w):
    ls = minmax(dict(lex)); vs = minmax(dict(vec)); ids = set(ls) | set(vs)
    scored = sorted(ids, key=lambda i: -((1-w)*ls.get(i, 0) + w*vs.get(i, 0)))
    return scored[:RSIZE]

def rrf(lex, vec, w, k=60):
    sc = {}
    for idx, (i, _) in enumerate(lex): sc[i] = sc.get(i, 0) + (1-w)/(k+idx+1)
    for idx, (i, _) in enumerate(vec): sc[i] = sc.get(i, 0) + w/(k+idx+1)
    return sorted(sc, key=lambda i: -sc[i])[:RSIZE]

best = {"label": "lexical-first-stage", "ndcgAtK": runs["lexical-first-stage"]}
for w in [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9]:
    ln = mean_ndcg({c["queryId"]: blend(lex_rank[str(c["queryId"])], vec_rank[str(c["queryId"])], w) for c in pool["cases"]})
    rf = mean_ndcg({c["queryId"]: rrf(lex_rank[str(c["queryId"])], vec_rank[str(c["queryId"])], w) for c in pool["cases"]})
    runs[f"hybrid-linear-{w}"] = ln; runs[f"hybrid-rrf-{w}"] = rf
    for lbl, v in [(f"hybrid-linear-{w}", ln), (f"hybrid-rrf-{w}", rf)]:
        if v > best["ndcgAtK"]: best = {"label": lbl, "ndcgAtK": v}

out = {"generatedAt":"2026-07-16T00:00:00.000Z","dataset":pool["dataset"],"model":emb.get("model"),
       "firstStage":pool.get("firstStage"),"k":K,"relevanceMode":"linear","queryCount":len(pool["cases"]),
       "best":{"label":best["label"],"metrics":{"ndcgAtK":best["ndcgAtK"]}},
       "lexicalBaseline":runs["lexical-first-stage"],"vectorOnly":runs["vector-only"],
       "runs":[{"label":k,"metrics":{"ndcgAtK":v}} for k,v in runs.items()]}
json.dump(out, open(out_path,"w"), indent=2)
print(json.dumps({"dataset":out["dataset"],"lexicalBaseline":out["lexicalBaseline"],"vectorOnly":out["vectorOnly"],"best":out["best"]["label"],"bestNdcg":out["best"]["metrics"]["ndcgAtK"]}))
