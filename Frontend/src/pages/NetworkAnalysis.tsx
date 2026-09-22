import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import "./NetworkAnalysis.css";

const API_BASE_URL =
  import.meta.env.VITE_IIS_API_URL || "http://localhost:8000";

type KeyEntity = {
  entity_id: string;
  label: string;
  type: string;
  degree: number;
  weighted_degree: number;
  relationship_count: number;
  relationship_types: string[];
  connected_entity_types: string[];
  rank: number;
};

type Finding = {
  type: string;
  severity: string;
  entity_id?: string;
  entity_label?: string;
  message: string;
  reason: string;
  relationship_id?: number;
  confidence?: number;
};

type CommunityEntity = {
  id: string;
  label: string;
  type: string;
};

type Community = {
  community_id: number;
  size: number;
  entity_ids: string[];
  entities: CommunityEntity[];
};

type AnalysisResponse = {
  case_id: string;
  statistics: {
    entities: number;
    relationships: number;
    communities: number;
    findings: number;
  };
  key_entities: KeyEntity[];
  communities: Community[];
  findings: Finding[];
};

type IntelligenceItem = {
  id: string;
  category: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  score: number;
  rank: number;
  title: string;
  entity_id?: string;
  entity_type?: string;
  entity_label?: string;
  target_entity_id?: string;
  target_entity_type?: string;
  target_entity_label?: string;
  relationship_id?: number;
  summary: string;
  why_it_matters: string;
  signals: string[];
  recommended_action: string;
};

type IntelligenceResponse = {
  case_id: string;
  statistics: {
    total_intelligence: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    categories: Record<string, number>;
  };
  intelligence: IntelligenceItem[];
};

type PathResponse = {
  case_id: string;
  found: boolean;
  source?: {
    id: string;
    label: string;
    type: string;
  };
  target?: {
    id: string;
    label: string;
    type: string;
  };
  distance?: number;
  entity_ids?: string[];
  relationships?: number[];
};

type EntityOption = {
  id: string;
  label: string;
  type: string;
};

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

function getEntityIcon(type: string) {
  switch (type.toLowerCase()) {
    case "person":
      return "P";
    case "organization":
      return "O";
    case "location":
      return "L";
    case "vehicle":
      return "V";
    case "phone":
      return "T";
    case "account":
    case "accountreference":
      return "A";
    default:
      return "•";
  }
}

function getTypeClass(type: string) {
  return type
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "CRITICAL":
      return "var(--amber)";
    case "HIGH":
      return "var(--teal)";
    default:
      return "var(--paper-dim)";
  }
}

export default function NetworkAnalysis() {
  const { caseId } = useParams<{ caseId: string }>();

  const [analysis, setAnalysis] =
    useState<AnalysisResponse | null>(null);

  const [intelligence, setIntelligence] =
    useState<IntelligenceResponse | null>(null);

  const [intelligenceLoading, setIntelligenceLoading] =
    useState(false);

  const [intelligenceError, setIntelligenceError] =
    useState("");

  const [entities, setEntities] =
    useState<EntityOption[]>([]);

  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");

  const [path, setPath] =
    useState<PathResponse | null>(null);

  const [pathLoading, setPathLoading] =
    useState(false);

  const [pathError, setPathError] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeTab, setActiveTab] =
    useState<
      | "overview"
      | "ranking"
      | "patterns"
      | "path"
      | "intelligence"
    >("overview");

  const [expandedCommunity, setExpandedCommunity] =
    useState<number | null>(null);

  useEffect(() => {
    if (!caseId) {
      setError("No case selected.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadAnalysis = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_BASE_URL}/network-analysis/case/${encodeURIComponent(
            caseId,
          )}`,
        );

        if (!response.ok) {
          const text = await response.text();

          throw new Error(
            text ||
              `Network analysis failed (${response.status}).`,
          );
        }

        const data =
          (await response.json()) as AnalysisResponse;

        if (!cancelled) {
          setAnalysis(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load network analysis.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadAnalysis();

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    if (!caseId) return;

    let cancelled = false;

    const loadIntelligence = async () => {
      try {
        setIntelligenceLoading(true);
        setIntelligenceError("");

        const response = await fetch(
          `${API_BASE_URL}/network-analysis/case/${encodeURIComponent(
            caseId,
          )}/intelligence`,
        );

        if (!response.ok) {
          const text = await response.text();

          throw new Error(
            text ||
              `Intelligence analysis failed (${response.status}).`,
          );
        }

        const data =
          (await response.json()) as IntelligenceResponse;

        if (!cancelled) {
          setIntelligence(data);
        }
      } catch (err) {
        if (!cancelled) {
          setIntelligenceError(
            err instanceof Error
              ? err.message
              : "Unable to load actionable intelligence.",
          );
        }
      } finally {
        if (!cancelled) {
          setIntelligenceLoading(false);
        }
      }
    };

    loadIntelligence();

    return () => {
      cancelled = true;
    };
  }, [caseId]);

  // Load the complete entity list for path selection.
  useEffect(() => {
    if (!caseId) return;

    const loadEntities = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/entities/case/${encodeURIComponent(
            caseId,
          )}`,
        );

        if (!response.ok) return;

        const data = await response.json();

        const rawEntities = Array.isArray(data)
          ? data
          : Array.isArray(data?.entities)
            ? data.entities
            : [];

        const normalized: EntityOption[] =
          rawEntities
            .map((entity: any) => ({
              id:
                entity.entity_id ||
                entity.id,
              label:
                entity.label ||
                entity.name ||
                entity.entity_id ||
                entity.id,
              type:
                entity.type ||
                "Unknown",
            }))
            .filter(
              (entity: EntityOption) =>
                Boolean(entity.id),
            );

        setEntities(normalized);
      } catch (err) {
        console.error(
          "Failed to load entities:",
          err,
        );
      }
    };

    loadEntities();
  }, [caseId]);

  const allEntities = useMemo(() => {
    if (entities.length > 0) {
      return entities;
    }

    return (
      analysis?.key_entities.map((entity) => ({
        id: entity.entity_id,
        label: entity.label,
        type: entity.type,
      })) || []
    );
  }, [entities, analysis]);

  const entityComposition = useMemo(() => {
    if (!analysis) return [];

    const counts: Record<string, number> = {};

    for (const entity of analysis.key_entities) {
      counts[entity.type] =
        (counts[entity.type] || 0) + 1;
    }

    const total = analysis.key_entities.length;

    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        count,
        percentage:
          total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [analysis]);

  const relationshipDistribution = useMemo(() => {
    if (!analysis) return [];

    const counts: Record<string, number> = {};

    for (const entity of analysis.key_entities) {
      for (const relationship of entity.relationship_types) {
        counts[relationship] =
          (counts[relationship] || 0) + 1;
      }
    }

    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [analysis]);

  const maxWeightedDegree = useMemo(() => {
    if (!analysis || analysis.key_entities.length === 0) {
      return 1;
    }

    return Math.max(
      ...analysis.key_entities.map(
        (entity) => entity.weighted_degree,
      ),
    );
  }, [analysis]);

  const findingsByType = useMemo(() => {
    if (!analysis) return [];

    const counts: Record<string, number> = {};

    for (const finding of analysis.findings) {
      counts[finding.type] =
        (counts[finding.type] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [analysis]);

  const runPathAnalysis = async () => {
    if (!caseId || !sourceId || !targetId) {
      setPathError(
        "Select both a source and target entity.",
      );
      return;
    }

    if (sourceId === targetId) {
      setPathError(
        "Source and target entities must be different.",
      );
      return;
    }

    try {
      setPathLoading(true);
      setPathError("");
      setPath(null);

      const params = new URLSearchParams({
        source_id: sourceId,
        target_id: targetId,
      });

      const response = await fetch(
        `${API_BASE_URL}/network-analysis/case/${encodeURIComponent(
          caseId,
        )}/path?${params.toString()}`,
      );

      if (!response.ok) {
        const text = await response.text();

        throw new Error(
          text ||
            `Path analysis failed (${response.status}).`,
        );
      }

      const data =
        (await response.json()) as PathResponse;

      setPath(data);
    } catch (err) {
      setPathError(
        err instanceof Error
          ? err.message
          : "Unable to calculate path.",
      );
    } finally {
      setPathLoading(false);
    }
  };

  const pathEntityMap = useMemo(() => {
    return new Map(
      allEntities.map((entity) => [
        entity.id,
        entity,
      ]),
    );
  }, [allEntities]);

  if (loading) {
    return (
      <div className="network-analysis-page">
        <div className="analysis-header">
          <div>
            <div className="analysis-eyebrow">
              INVESTIGATION INTELLIGENCE
            </div>

            <h1>Network Analysis</h1>

            <p>
              Analyzing the current investigation
              network...
            </p>
          </div>

          <div className="analysis-status">
            <span className="status-dot" />
            ANALYZING NETWORK
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="network-analysis-page">
        <div className="analysis-header">
          <div>
            <div className="analysis-eyebrow">
              INVESTIGATION INTELLIGENCE
            </div>

            <h1>Network Analysis</h1>

            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="network-analysis-page">
        <div className="analysis-header">
          <div>
            <div className="analysis-eyebrow">
              INVESTIGATION INTELLIGENCE
            </div>

            <h1>Network Analysis</h1>

            <p>
              No network analysis is available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="network-analysis-page">

      <header className="analysis-header">
        <div>
          <div className="analysis-breadcrumb">
            <span>Investigation</span>
            <span>/</span>
            <strong>Network Analysis</strong>
          </div>

          <div className="analysis-eyebrow">
            CASE {analysis.case_id}
          </div>

          <h1>Network Analysis</h1>

          <p>
            Structural analysis of entities,
            relationships, connected communities and
            investigation signals.
          </p>
        </div>

        <div className="analysis-status">
          <span className="status-dot" />
          ANALYSIS COMPLETE
        </div>
      </header>


      <section className="analysis-metrics">

        <div className="analysis-metric-card">
          <span className="metric-label">
            ENTITIES
          </span>
          <strong>
            {analysis.statistics.entities}
          </strong>
          <small>
            Identified network entities
          </small>
        </div>

        <div className="analysis-metric-card">
          <span className="metric-label">
            RELATIONSHIPS
          </span>
          <strong>
            {analysis.statistics.relationships}
          </strong>
          <small>
            Known network connections
          </small>
        </div>

        <div className="analysis-metric-card">
          <span className="metric-label">
            COMMUNITIES
          </span>
          <strong>
            {analysis.statistics.communities}
          </strong>
          <small>
            Connected network groups
          </small>
        </div>

        <div className="analysis-metric-card">
          <span className="metric-label">
            FINDINGS
          </span>
          <strong>
            {analysis.statistics.findings}
          </strong>
          <small>
            Investigation signals
          </small>
        </div>

      </section>


      <nav className="analysis-tabs">

        <button
          className={
            activeTab === "overview"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("overview")
          }
        >
          Overview
        </button>

        <button
          className={
            activeTab === "ranking"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("ranking")
          }
        >
          Entity Ranking
        </button>

        <button
          className={
            activeTab === "patterns"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("patterns")
          }
        >
          Patterns
        </button>

        <button
          className={
            activeTab === "intelligence"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("intelligence")
          }
        >
          Intelligence
        </button>

        <button
          className={
            activeTab === "path"
              ? "active"
              : ""
          }
          onClick={() =>
            setActiveTab("path")
          }
        >
          Connection Path
        </button>

      </nav>


      {/* ACTIONABLE INTELLIGENCE */}

      {activeTab === "intelligence" && (
        <div className="analysis-grid">

          {intelligenceLoading && (
            <section className="analysis-panel wide">

              <div className="panel-heading">
                <div>
                  <span className="panel-eyebrow">
                    ACTIONABLE INTELLIGENCE
                  </span>

                  <h2>
                    Analyzing Investigation Signals
                  </h2>

                  <p>
                    Generating investigator-oriented
                    leads from the current network.
                  </p>
                </div>

                <span className="panel-code">
                  ANALYZING
                </span>
              </div>

            </section>
          )}


          {intelligenceError && (
            <section className="analysis-panel wide">

              <div className="panel-heading">
                <div>
                  <span className="panel-eyebrow">
                    INTELLIGENCE ERROR
                  </span>

                  <h2>
                    Unable to load intelligence
                  </h2>

                  <p>
                    {intelligenceError}
                  </p>
                </div>
              </div>

            </section>
          )}


          {intelligence &&
            !intelligenceLoading && (
              <>

                <section className="analysis-panel wide">

                  <div className="panel-heading">
                    <div>
                      <span className="panel-eyebrow">
                        ACTIONABLE INTELLIGENCE
                      </span>

                      <h2>
                        Investigation Leads
                      </h2>

                      <p>
                        Analytical leads generated
                        from the current evidence
                        network. These require
                        investigator verification.
                      </p>
                    </div>

                    <span className="panel-code">
                      {
                        intelligence.statistics
                          .total_intelligence
                      }{" "}
                      LEADS
                    </span>
                  </div>


                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(4, 1fr)",
                      gap: "10px",
                      padding: "18px",
                    }}
                  >

                    {[
                      {
                        label: "CRITICAL",
                        value:
                          intelligence
                            .statistics
                            .critical,
                      },
                      {
                        label: "HIGH",
                        value:
                          intelligence
                            .statistics
                            .high,
                      },
                      {
                        label: "MEDIUM",
                        value:
                          intelligence
                            .statistics
                            .medium,
                      },
                      {
                        label: "LOW",
                        value:
                          intelligence
                            .statistics
                            .low,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          padding: "12px",
                          background:
                            "var(--panel-2)",
                          border:
                            "1px solid var(--line)",
                          borderRadius: "5px",
                        }}
                      >

                        <span
                          style={{
                            display: "block",
                            color:
                              "var(--paper-faint)",
                            fontSize: "8px",
                            fontFamily:
                              "var(--font-mono)",
                            marginBottom: "6px",
                          }}
                        >
                          {item.label}
                        </span>

                        <strong
                          style={{
                            color:
                              item.label ===
                                "CRITICAL" ||
                              item.label ===
                                "HIGH"
                                ? "var(--amber)"
                                : "var(--paper)",
                            fontSize: "20px",
                            fontFamily:
                              "var(--font-mono)",
                          }}
                        >
                          {item.value}
                        </strong>

                      </div>
                    ))}

                  </div>

                </section>


                <section className="analysis-panel wide">

                  <div className="panel-heading">
                    <div>
                      <span className="panel-eyebrow">
                        PRIORITIZED LEADS
                      </span>

                      <h2>
                        Intelligence Findings
                      </h2>

                      <p>
                        Ranked analytical signals
                        requiring investigator
                        attention.
                      </p>
                    </div>

                    <span className="panel-code">
                      PRIORITY
                    </span>
                  </div>


                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >

                    {intelligence.intelligence.map(
                      (item) => {

                        const priorityColor =
                          getPriorityColor(
                            item.priority,
                          );

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: "18px",
                              borderBottom:
                                "1px solid var(--line-soft)",
                            }}
                          >

                            <div
                              style={{
                                display: "flex",
                                alignItems:
                                  "flex-start",
                                justifyContent:
                                  "space-between",
                                gap: "15px",
                              }}
                            >

                              <div
                                style={{
                                  display: "flex",
                                  gap: "12px",
                                  minWidth: 0,
                                }}
                              >

                                <span className="rank-number">
                                  #{item.rank}
                                </span>

                                {item.entity_type && (
                                  <div
                                    className={`analysis-entity-icon ${getTypeClass(
                                      item.entity_type,
                                    )}`}
                                  >
                                    {getEntityIcon(
                                      item.entity_type,
                                    )}
                                  </div>
                                )}

                                <div>

                                  <h3
                                    style={{
                                      margin: 0,
                                      color:
                                        "var(--paper)",
                                      fontSize:
                                        "12px",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {item.title}
                                  </h3>

                                  {item.entity_label && (
                                    <div
                                      style={{
                                        marginTop:
                                          "5px",
                                        color:
                                          "var(--paper-faint)",
                                        fontSize:
                                          "8px",
                                        fontFamily:
                                          "var(--font-mono)",
                                      }}
                                    >
                                      {
                                        item.entity_label
                                      }

                                      {item.target_entity_label
                                        ? ` → ${item.target_entity_label}`
                                        : ""}
                                    </div>
                                  )}

                                </div>

                              </div>


                              <span
                                className="pattern-tag"
                                style={{
                                  color:
                                    priorityColor,
                                  borderColor:
                                    priorityColor,
                                  flexShrink: 0,
                                }}
                              >
                                {item.priority}
                              </span>

                            </div>


                            <div
                              style={{
                                marginTop:
                                  "15px",
                                display: "grid",
                                gridTemplateColumns:
                                  "1fr 1fr",
                                gap: "12px",
                              }}
                            >

                              <div
                                style={{
                                  padding:
                                    "12px",
                                  background:
                                    "var(--panel-2)",
                                  border:
                                    "1px solid var(--line-soft)",
                                  borderRadius:
                                    "5px",
                                }}
                              >

                                <span
                                  style={{
                                    display:
                                      "block",
                                    marginBottom:
                                      "6px",
                                    color:
                                      "var(--paper-faint)",
                                    fontSize:
                                      "8px",
                                    fontFamily:
                                      "var(--font-mono)",
                                  }}
                                >
                                  WHY IT MATTERS
                                </span>

                                <p
                                  style={{
                                    margin: 0,
                                    color:
                                      "var(--paper-dim)",
                                    fontSize:
                                      "9px",
                                    lineHeight:
                                      1.6,
                                  }}
                                >
                                  {
                                    item.why_it_matters
                                  }
                                </p>

                              </div>


                              <div
                                style={{
                                  padding:
                                    "12px",
                                  background:
                                    "var(--panel-2)",
                                  border:
                                    "1px solid var(--line-soft)",
                                  borderRadius:
                                    "5px",
                                }}
                              >

                                <span
                                  style={{
                                    display:
                                      "block",
                                    marginBottom:
                                      "6px",
                                    color:
                                      "var(--paper-faint)",
                                    fontSize:
                                      "8px",
                                    fontFamily:
                                      "var(--font-mono)",
                                  }}
                                >
                                  INVESTIGATION LEAD
                                </span>

                                <p
                                  style={{
                                    margin: 0,
                                    color:
                                      "var(--paper-dim)",
                                    fontSize:
                                      "9px",
                                    lineHeight:
                                      1.6,
                                  }}
                                >
                                  {
                                    item.recommended_action
                                  }
                                </p>

                              </div>

                            </div>


                            <div
                              style={{
                                marginTop:
                                  "12px",
                              }}
                            >

                              <span
                                style={{
                                  display:
                                    "block",
                                  marginBottom:
                                    "7px",
                                  color:
                                    "var(--paper-faint)",
                                  fontSize:
                                    "8px",
                                  fontFamily:
                                    "var(--font-mono)",
                                }}
                              >
                                DETECTED SIGNALS
                              </span>

                              <div
                                style={{
                                  display:
                                    "flex",
                                  flexWrap:
                                    "wrap",
                                  gap: "6px",
                                }}
                              >

                                {item.signals.map(
                                  (signal) => (
                                    <span
                                      key={signal}
                                      className="pattern-tag"
                                    >
                                      {signal}
                                    </span>
                                  ),
                                )}

                              </div>

                            </div>


                            <p
                              style={{
                                margin:
                                  "12px 0 0",
                                color:
                                  "var(--paper-faint)",
                                fontSize:
                                  "9px",
                                lineHeight:
                                  1.6,
                              }}
                            >
                              {item.summary}
                            </p>

                          </div>
                        );
                      },
                    )}


                    {intelligence.intelligence
                      .length === 0 && (
                      <div
                        style={{
                          padding: "25px",
                          color:
                            "var(--paper-dim)",
                          fontSize: "10px",
                        }}
                      >
                        No actionable intelligence
                        was generated from the
                        current network.
                      </div>
                    )}

                  </div>

                </section>

              </>
            )}

        </div>
      )}


      {/* CONNECTION PATH */}

      {activeTab === "path" && (
        <div className="analysis-grid">

          <section className="analysis-panel wide">

            <div className="panel-heading">

              <div>
                <span className="panel-eyebrow">
                  CONNECTION ANALYSIS
                </span>

                <h2>
                  Investigate Connection Path
                </h2>

                <p>
                  Select two entities to find the
                  shortest known relationship path
                  between them.
                </p>
              </div>

              <span className="panel-code">
                SHORTEST PATH
              </span>

            </div>

            <div
              style={{
                padding: "18px",
              }}
            >

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 40px 1fr auto",
                  alignItems: "end",
                  gap: "10px",
                }}
              >

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    color: "var(--paper-dim)",
                    fontSize: "9px",
                  }}
                >
                  SOURCE ENTITY

                  <select
                    value={sourceId}
                    onChange={(event) => {
                      setSourceId(
                        event.target.value,
                      );
                      setPath(null);
                      setPathError("");
                    }}
                    style={{
                      width: "100%",
                      padding: "10px",
                      color: "var(--paper)",
                      background:
                        "var(--panel-2)",
                      border:
                        "1px solid var(--line)",
                      borderRadius: "5px",
                      outline: "none",
                      fontSize: "10px",
                    }}
                  >
                    <option value="">
                      Select source...
                    </option>

                    {allEntities.map((entity) => (
                      <option
                        key={entity.id}
                        value={entity.id}
                      >
                        {entity.label} ·{" "}
                        {entity.type}
                      </option>
                    ))}
                  </select>
                </label>

                <div
                  style={{
                    color: "var(--amber)",
                    textAlign: "center",
                    paddingBottom: "9px",
                    fontFamily:
                      "var(--font-mono)",
                  }}
                >
                  →
                </div>

                <label
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    color: "var(--paper-dim)",
                    fontSize: "9px",
                  }}
                >
                  TARGET ENTITY

                  <select
                    value={targetId}
                    onChange={(event) => {
                      setTargetId(
                        event.target.value,
                      );
                      setPath(null);
                      setPathError("");
                    }}
                    style={{
                      width: "100%",
                      padding: "10px",
                      color: "var(--paper)",
                      background:
                        "var(--panel-2)",
                      border:
                        "1px solid var(--line)",
                      borderRadius: "5px",
                      outline: "none",
                      fontSize: "10px",
                    }}
                  >
                    <option value="">
                      Select target...
                    </option>

                    {allEntities.map((entity) => (
                      <option
                        key={entity.id}
                        value={entity.id}
                      >
                        {entity.label} ·{" "}
                        {entity.type}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  onClick={runPathAnalysis}
                  disabled={
                    pathLoading ||
                    !sourceId ||
                    !targetId
                  }
                  style={{
                    padding: "10px 15px",
                    color:
                      "var(--bg)",
                    background:
                      "var(--amber)",
                    border: 0,
                    borderRadius: "5px",
                    fontSize: "9px",
                    fontWeight: 600,
                    cursor:
                      pathLoading ||
                      !sourceId ||
                      !targetId
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      pathLoading ||
                      !sourceId ||
                      !targetId
                        ? 0.45
                        : 1,
                  }}
                >
                  {pathLoading
                    ? "ANALYZING..."
                    : "FIND PATH"}
                </button>

              </div>

              {pathError && (
                <div
                  style={{
                    marginTop: "12px",
                    color: "#d97878",
                    fontSize: "9px",
                  }}
                >
                  {pathError}
                </div>
              )}

            </div>

          </section>


          {path && (
            <section className="analysis-panel wide">

              <div className="panel-heading">

                <div>
                  <span className="panel-eyebrow">
                    PATH RESULT
                  </span>

                  <h2>
                    Connection Chain
                  </h2>

                  <p>
                    {path.found
                      ? `Shortest path contains ${path.distance} relationship ${
                          path.distance === 1
                            ? "step"
                            : "steps"
                        }.`
                      : "No connection was found between the selected entities."}
                  </p>
                </div>

                <span className="panel-code">
                  {path.found
                    ? `${path.distance} STEPS`
                    : "NO PATH"}
                </span>

              </div>

              {path.found &&
              path.entity_ids &&
              path.entity_ids.length > 0 ? (
                <div
                  style={{
                    padding: "18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >

                  {path.entity_ids.map(
                    (entityId, index) => {
                      const entity =
                        pathEntityMap.get(
                          entityId,
                        );

                      return (
                        <div
                          key={entityId}
                          style={{
                            display: "flex",
                            alignItems:
                              "center",
                            gap: "12px",
                          }}
                        >

                          <div
                            className={`analysis-entity-icon ${
                              entity
                                ? getTypeClass(
                                    entity.type,
                                  )
                                : ""
                            }`}
                          >
                            {entity
                              ? getEntityIcon(
                                  entity.type,
                                )
                              : "?"}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection:
                                "column",
                              gap: "3px",
                            }}
                          >
                            <strong
                              style={{
                                color:
                                  "var(--paper)",
                                fontSize:
                                  "10px",
                              }}
                            >
                              {entity?.label ||
                                entityId}
                            </strong>

                            <small
                              style={{
                                color:
                                  "var(--paper-faint)",
                                fontSize:
                                  "8px",
                              }}
                            >
                              {entity?.type ||
                                "Entity"}
                            </small>
                          </div>

                          {index <
                            path.entity_ids!
                              .length -
                              1 && (
                            <div
                              style={{
                                marginLeft:
                                  "5px",
                                color:
                                  "var(--amber)",
                                fontFamily:
                                  "var(--font-mono)",
                                fontSize:
                                  "11px",
                              }}
                            >
                              ↓
                            </div>
                          )}

                        </div>
                      );
                    },
                  )}

                </div>
              ) : (
                <div
                  style={{
                    padding: "20px",
                    color:
                      "var(--paper-dim)",
                    fontSize: "10px",
                  }}
                >
                  No relationship path exists
                  between the selected entities in
                  the current graph.
                </div>
              )}

            </section>
          )}

        </div>
      )}


      {/* OVERVIEW */}

      {activeTab === "overview" && (
        <div className="analysis-grid">

          <section className="analysis-panel">

            <div className="panel-heading">
              <div>
                <span className="panel-eyebrow">
                  ENTITY COMPOSITION
                </span>

                <h2>
                  Network Entities
                </h2>

                <p>
                  Distribution of entity categories
                  in the analyzed network.
                </p>
              </div>

              <span className="panel-code">
                ENTITY.TYPE
              </span>
            </div>

            <div className="composition-list">

              {entityComposition.map((item) => (
                <div
                  className="composition-row"
                  key={item.type}
                >
                  <div className="composition-label">
                    <span>{item.type}</span>

                    <strong>
                      {item.count}
                    </strong>
                  </div>

                  <div className="composition-bar">
                    <div
                      style={{
                        width: `${item.percentage}%`,
                      }}
                    />
                  </div>
                </div>
              ))}

            </div>

          </section>


          <section className="analysis-panel">

            <div className="panel-heading">
              <div>
                <span className="panel-eyebrow">
                  RELATIONSHIP DISTRIBUTION
                </span>

                <h2>
                  Connection Types
                </h2>

                <p>
                  Relationship types around the
                  analyzed entities.
                </p>
              </div>

              <span className="panel-code">
                RELATION.TYPE
              </span>
            </div>

            <div className="relationship-distribution">

              {relationshipDistribution.map(
                (item) => {
                  const maximum =
                    relationshipDistribution[0]
                      ?.count || 1;

                  return (
                    <div
                      className="distribution-row"
                      key={item.type}
                    >
                      <div className="distribution-top">
                        <span>
                          {item.type}
                        </span>

                        <strong>
                          {item.count}
                        </strong>
                      </div>

                      <div className="distribution-bar">
                        <div
                          style={{
                            width: `${
                              (item.count /
                                maximum) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                },
              )}

            </div>

          </section>


          <section className="analysis-panel wide">

            <div className="panel-heading">
              <div>
                <span className="panel-eyebrow">
                  NETWORK CENTRALITY
                </span>

                <h2>
                  Most Connected Entities
                </h2>

                <p>
                  Ranked by weighted network
                  connectivity.
                </p>
              </div>

              <span className="panel-code">
                CENTRALITY
              </span>
            </div>

            <div className="influential-list">

              {analysis.key_entities
                .slice(0, 5)
                .map((entity) => {
                  const percentage =
                    (entity.weighted_degree /
                      maxWeightedDegree) *
                    100;

                  return (
                    <div
                      className="influential-row"
                      key={entity.entity_id}
                    >
                      <span className="rank-number">
                        #{entity.rank}
                      </span>

                      <div
                        className={`analysis-entity-icon ${getTypeClass(
                          entity.type,
                        )}`}
                      >
                        {getEntityIcon(
                          entity.type,
                        )}
                      </div>

                      <div className="influential-name">
                        <strong>
                          {entity.label}
                        </strong>

                        <small>
                          {entity.type} ·{" "}
                          {
                            entity.relationship_count
                          }{" "}
                          relationships
                        </small>
                      </div>

                      <div className="centrality-bar-wrap">
                        <div className="centrality-bar">
                          <div
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="centrality-score">
                        <strong>
                          {entity.weighted_degree.toFixed(
                            2,
                          )}
                        </strong>

                        <span>
                          weighted degree
                        </span>
                      </div>
                    </div>
                  );
                })}

            </div>

          </section>


          <section className="analysis-panel wide">

            <div className="panel-heading">
              <div>
                <span className="panel-eyebrow">
                  NETWORK STRUCTURE
                </span>

                <h2>
                  Connected Communities
                </h2>

                <p>
                  Groups of entities connected within
                  the current graph.
                </p>
              </div>

              <span className="panel-code">
                COMPONENTS
              </span>
            </div>

            <div className="influential-list">

              {analysis.communities.map(
                (community) => {
                  const expanded =
                    expandedCommunity ===
                    community.community_id;

                  return (
                    <div
                      key={community.community_id}
                      style={{
                        borderBottom:
                          "1px solid var(--line-soft)",
                      }}
                    >
                      <button
                        onClick={() =>
                          setExpandedCommunity(
                            expanded
                              ? null
                              : community.community_id,
                          )
                        }
                        style={{
                          width: "100%",
                          minHeight: "58px",
                          display: "grid",
                          gridTemplateColumns:
                            "60px 1fr 70px",
                          alignItems: "center",
                          gap: "10px",
                          padding: 0,
                          color:
                            "var(--paper)",
                          background:
                            "transparent",
                          border: 0,
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span className="rank-number">
                          C
                          {
                            community.community_id
                          }
                        </span>

                        <span className="influential-name">
                          <strong>
                            Community{" "}
                            {
                              community.community_id
                            }
                          </strong>

                          <small>
                            {community.size}{" "}
                            {community.size ===
                            1
                              ? "entity"
                              : "entities"}
                          </small>
                        </span>

                        <span className="centrality-score">
                          <strong>
                            {expanded
                              ? "−"
                              : "+"}
                          </strong>
                        </span>
                      </button>

                      {expanded && (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(3, 1fr)",
                            gap: "8px",
                            padding:
                              "0 0 14px 70px",
                          }}
                        >
                          {community.entities.map(
                            (entity) => (
                              <div
                                key={entity.id}
                                style={{
                                  padding:
                                    "8px 10px",
                                  background:
                                    "var(--panel-2)",
                                  border:
                                    "1px solid var(--line)",
                                  borderRadius:
                                    "5px",
                                }}
                              >
                                <strong
                                  style={{
                                    display:
                                      "block",
                                    color:
                                      "var(--paper)",
                                    fontSize:
                                      "9px",
                                  }}
                                >
                                  {entity.label}
                                </strong>

                                <small
                                  style={{
                                    display:
                                      "block",
                                    marginTop:
                                      "3px",
                                    color:
                                      "var(--paper-faint)",
                                    fontSize:
                                      "7px",
                                  }}
                                >
                                  {entity.type}
                                </small>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  );
                },
              )}

            </div>

          </section>

        </div>
      )}


      {/* RANKING */}

      {activeTab === "ranking" && (
        <section className="analysis-panel full-panel">

          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">
                ENTITY ANALYSIS
              </span>

              <h2>
                Network Entity Ranking
              </h2>

              <p>
                Entities ranked by connectivity and
                relationship strength.
              </p>
            </div>

            <span className="panel-code">
              RANKING
            </span>
          </div>

          <div className="ranking-table">

            <div className="ranking-header">
              <span>Rank</span>
              <span>Entity</span>
              <span>Type</span>
              <span>Connections</span>
              <span>Weighted Degree</span>
            </div>

            {analysis.key_entities.map(
              (entity) => {
                const percentage =
                  (entity.weighted_degree /
                    maxWeightedDegree) *
                  100;

                return (
                  <div
                    className="ranking-row"
                    key={entity.entity_id}
                  >
                    <span className="rank-number">
                      #{entity.rank}
                    </span>

                    <div className="ranking-entity">
                      <div
                        className={`analysis-entity-icon ${getTypeClass(
                          entity.type,
                        )}`}
                      >
                        {getEntityIcon(
                          entity.type,
                        )}
                      </div>

                      <div>
                        <strong>
                          {entity.label}
                        </strong>

                        <small>
                          {
                            entity.relationship_count
                          }{" "}
                          relationships
                        </small>
                      </div>
                    </div>

                    <span className="ranking-type">
                      {entity.type}
                    </span>

                    <strong className="ranking-connections">
                      {entity.degree}
                    </strong>

                    <div className="ranking-score">
                      <div>
                        <span
                          style={{
                            width: `${percentage}%`,
                          }}
                        />
                      </div>

                      <small>
                        {entity.weighted_degree.toFixed(
                          2,
                        )}
                      </small>
                    </div>
                  </div>
                );
              },
            )}

          </div>

        </section>
      )}


      {/* PATTERNS */}

      {activeTab === "patterns" && (
        <section className="analysis-panel full-panel">

          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">
                INVESTIGATIVE SIGNALS
              </span>

              <h2>
                Detected Network Patterns
              </h2>

              <p>
                Structural signals generated from the
                current evidence network.
              </p>
            </div>

            <span className="panel-code">
              PATTERNS
            </span>
          </div>

          <div className="patterns-grid">

            {findingsByType.map((pattern) => {
              const finding =
                analysis.findings.find(
                  (item) =>
                    item.type === pattern.type,
                );

              return (
                <div
                  className="analysis-panel"
                  key={pattern.type}
                >
                  <div className="panel-heading">
                    <div>
                      <span className="panel-eyebrow">
                        SIGNAL
                      </span>

                      <h2>
                        {formatLabel(
                          pattern.type,
                        )}
                      </h2>
                    </div>

                    <span className="pattern-tag">
                      {finding?.severity ||
                        "INFO"}
                    </span>
                  </div>

                  <div className="pattern-content">
                    <div className="pattern-number">
                      {pattern.count}
                    </div>

                    <p>
                      {finding?.reason ||
                        "Structural pattern detected in the investigation network."}
                    </p>
                  </div>
                </div>
              );
            })}

          </div>

        </section>
      )}


      <div className="analysis-disclaimer">
        <strong>
          Investigator review required.
        </strong>{" "}
        Network metrics and structural signals
        identify patterns in available evidence.
        They do not independently establish criminal
        activity, intent or guilt.
      </div>

    </div>
  );
}