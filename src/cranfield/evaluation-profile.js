import { TRACEABILITY } from "../traceability.js";

export const CRANFIELD_EVALUATION_PROFILE = {
  dataset: "cranfield",
  index: "cranfield-v0",
  run: "live-opensearch",
  generatedAt: "2026-07-04T00:00:00.000Z",
  traceability: {
    missionId: TRACEABILITY.missionId,
    searchEvolutionId: TRACEABILITY.searchEvolutionId,
    architectureVersion: TRACEABILITY.architectureVersion,
    architectureSlug: TRACEABILITY.architectureSlug,
    architectureDecisionIds: TRACEABILITY.architectureDecisionIds,
    gitTag: TRACEABILITY.gitTag,
    endpointVersion: TRACEABILITY.endpointVersion
  },
  k: 10,
  queryCount: 225,
  metrics: {
    map: 0.2402,
    ndcgAt10: 0.2995,
    precisionAt10: 0.2316,
    recallAt10: 0.3994,
    mrr: 0.535
  },
  notes: [
    "This is a transparent BM25 baseline, not a tuned retail ranking model.",
    "Correct means the returned document appears in the Cranfield qrels with a positive relevance grade.",
    "Wrong or missed examples are useful: they show where lexical BM25 matches words but misses the human relevance judgment."
  ],
  examples: [
    {
      type: "strong",
      label: "Strong baseline case",
      queryId: "3",
      query: "what problems of heat conduction in composite slabs have been solved so far .",
      relevantCount: 8,
      metrics: {
        precisionAt10: 0.6,
        recallAt10: 0.75,
        ndcgAt10: 0.7892,
        reciprocalRank: 1
      },
      correctResults: [
        {
          rank: 1,
          id: "399",
          grade: 3,
          title: "conduction of heat in composite slabs ."
        },
        {
          rank: 2,
          id: "144",
          grade: 3,
          title: "heat flow in composite slabs ."
        },
        {
          rank: 4,
          id: "5",
          grade: 3,
          title: "one-dimensional transient heat conduction into a double-layer slab subjected to a linear heat input for a small time internal ."
        }
      ],
      wrongOrWeakResults: [
        {
          rank: 3,
          id: "485",
          grade: -1,
          title: "linear heat flow in a composite slab .",
          reason: "Looks lexically close, but the Cranfield judgment marks it non-relevant for this query."
        }
      ],
      missedRelevant: [
        {
          id: "6",
          grade: 3
        },
        {
          id: "119",
          grade: 3
        }
      ]
    },
    {
      type: "mixed",
      label: "Mixed case",
      queryId: "1",
      query: "what similarity laws must be obeyed when constructing aeroelastic models of heated high speed aircraft .",
      relevantCount: 28,
      metrics: {
        precisionAt10: 0.5,
        recallAt10: 0.1786,
        ndcgAt10: 0.3489,
        reciprocalRank: 1
      },
      correctResults: [
        {
          rank: 1,
          id: "51",
          grade: 3,
          title: "theory of aircraft structural models subjected to aerodynamic heating and external loads ."
        },
        {
          rank: 2,
          id: "13",
          grade: 4,
          title: "similarity laws for stressing heated wings ."
        },
        {
          rank: 4,
          id: "184",
          grade: 2,
          title: "scale models for thermo-aeroelastic research ."
        }
      ],
      wrongOrWeakResults: [
        {
          rank: 3,
          id: "486",
          grade: -1,
          title: "similarity laws for aerothermoelastic testing .",
          reason: "The title looks highly related, but the qrel grade is negative for this query."
        },
        {
          rank: 6,
          id: "746",
          grade: 0,
          title: "aeroelastic problems in connection with high speed flight .",
          reason: "Word overlap is strong, but it is not one of the judged relevant documents."
        }
      ],
      missedRelevant: [
        {
          id: "14",
          grade: 4
        },
        {
          id: "15",
          grade: 4
        },
        {
          id: "52",
          grade: 4
        }
      ]
    },
    {
      type: "weak",
      label: "Failure case",
      queryId: "13",
      query: "what is the basic mechanism of the transonic aileron buzz .",
      relevantCount: 4,
      metrics: {
        precisionAt10: 0,
        recallAt10: 0,
        ndcgAt10: 0,
        reciprocalRank: 0
      },
      correctResults: [],
      wrongOrWeakResults: [
        {
          rank: 1,
          id: "496",
          grade: -1,
          title: "a theory of transonic aileron buzz, neglecting viscous effects .",
          reason: "The lexical match is excellent, but Cranfield marks it non-relevant to the requested mechanism."
        },
        {
          rank: 2,
          id: "313",
          grade: 0,
          title: "on alternative forms for the basic equations of transonic flow theory .",
          reason: "Matches transonic vocabulary but misses the aileron buzz information need."
        }
      ],
      missedRelevant: [
        {
          id: "64",
          grade: 2
        },
        {
          id: "65",
          grade: 4
        },
        {
          id: "265",
          grade: 2
        },
        {
          id: "311",
          grade: 4
        }
      ]
    }
  ]
};
