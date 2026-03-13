const STATUS_CLASS_MAP = {
  Active: "status-active",
  "In review": "status-in-review",
  "In development": "status-in-development",
};

const FILTERS = {
  all: () => true,
  priority: (project) => Number(project.priority_rank) <= 3,
  active: (project) => project.current_status === "Active",
  review: (project) => project.current_status === "In review" || project.current_status === "In development",
  public: (project) => /^https?:\/\//.test(project.public_url_or_access),
};

const state = {
  projects: [],
  activeFilter: "all",
};

document.addEventListener("DOMContentLoaded", async () => {
  const metricGrid = document.getElementById("metric-grid");
  const projectGrid = document.getElementById("project-grid");
  const exportButton = document.getElementById("export-review-notes");

  try {
    const response = await fetch("./SUPERVISOR_PROJECT_VISIBILITY_TRACKER.csv", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Failed to load tracker: ${response.status}`);
    }

    const csvText = await response.text();
    state.projects = parseCsv(csvText).map(normalizeProject);

    renderMetrics(metricGrid, state.projects);
    renderProjects(projectGrid, state.projects, state.activeFilter);
    bindFilters(projectGrid);
    bindExportButton(exportButton);
  } catch (error) {
    metricGrid.innerHTML = "";
    projectGrid.innerHTML = `<div class="empty-state">The dashboard could not load the tracker data. Open the raw CSV instead.</div>`;
    console.error(error);
  }
});

function bindFilters(projectGrid) {
  const chips = document.querySelectorAll(".filter-chip");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.activeFilter = chip.dataset.filter || "all";

      chips.forEach((button) => button.classList.remove("is-active"));
      chip.classList.add("is-active");

      renderProjects(projectGrid, state.projects, state.activeFilter);
    });
  });
}

function renderMetrics(container, projects) {
  const publicCount = projects.filter((project) => /^https?:\/\//.test(project.public_url_or_access)).length;
  const activeCount = projects.filter((project) => project.current_status === "Active").length;
  const reviewCount = projects.filter((project) => project.current_status !== "Active").length;
  const priorityCount = projects.filter((project) => Number(project.priority_rank) <= 3).length;

  const metrics = [
    {
      label: "Total projects",
      value: projects.length,
      subline: "Visible body of work currently being tracked",
    },
    {
      label: "Active now",
      value: activeCount,
      subline: "Projects already moving in delivery or rollout",
    },
    {
      label: "Public outputs",
      value: publicCount,
      subline: "Live demos or public reference URLs available",
    },
    {
      label: "Leadership focus",
      value: priorityCount,
      subline: `${reviewCount} project${reviewCount === 1 ? "" : "s"} currently need review, access, or visibility decisions`,
    },
  ];

  container.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric-card">
          <p class="metric-label">${escapeHtml(metric.label)}</p>
          <p class="metric-value">${escapeHtml(String(metric.value))}</p>
          <p class="metric-subline">${escapeHtml(metric.subline)}</p>
        </article>
      `
    )
    .join("");
}

function renderProjects(container, projects, activeFilter) {
  const filteredProjects = projects.filter(FILTERS[activeFilter] || FILTERS.all);

  if (!filteredProjects.length) {
    container.innerHTML = `<div class="empty-state">No projects match the current filter.</div>`;
    return;
  }

  container.innerHTML = filteredProjects
    .map((project) => {
      const statusClass = STATUS_CLASS_MAP[project.current_status] || "";
      const urlMarkup = /^https?:\/\//.test(project.public_url_or_access)
        ? `
          <div class="project-link-group">
            <a class="project-url project-url-primary" href="${escapeAttribute(project.public_url_or_access)}" target="_blank" rel="noreferrer">Open link</a>
            <p class="project-url-meta">${escapeHtml(formatUrlDisplay(project.public_url_or_access))}</p>
          </div>
        `
        : `
          <div class="project-link-group">
            <span class="project-url is-muted">${escapeHtml(project.public_url_or_access || "No public link")}</span>
            <p class="project-url-meta">${escapeHtml(getAccessMeta(project.public_url_or_access))}</p>
          </div>
        `;

      return `
        <article class="project-card" data-project-key="${escapeAttribute(getProjectKey(project))}">
          <header class="project-card-header">
            <div class="project-card-title-wrap">
              <div class="project-card-title-line">
                <span class="project-rank">${escapeHtml(String(project.priority_rank))}</span>
                <h2 class="project-title">${escapeHtml(project.project_title)}</h2>
              </div>
              <div class="project-meta-row">
                <span class="workstream-pill">${escapeHtml(project.workstream)}</span>
                <span class="status-pill ${statusClass}">${escapeHtml(project.current_status)}</span>
              </div>
            </div>
            <div class="project-card-header-side">
              <p class="card-kicker">Product link</p>
              ${urlMarkup}
            </div>
          </header>

          <div class="project-card-layout">
            <div class="project-column">
              <section class="detail-panel">
                <div class="section-heading-row">
                  <p class="section-kicker">Project</p>
                  <p class="project-tagline">Lead: ${escapeHtml(project.lead_consultant || "Andi Shehu")}</p>
                </div>
                <p class="card-text">${escapeHtml(project.what_the_project_does)}</p>
                <div class="beneficiary-line">
                  <span class="beneficiary-label">Primary users:</span>
                  <span class="card-beneficiaries">${escapeHtml(project.primary_users_or_beneficiaries)}</span>
                </div>
              </section>

              <section class="detail-panel emphasis-panel">
                <p class="section-kicker">Why it matters to NYU</p>
                <p class="card-text">${escapeHtml(project.why_it_matters_to_nyu)}</p>
              </section>
            </div>

            <div class="project-column">
              <section class="detail-panel">
                <p class="section-kicker">Work completed</p>
                <p class="card-text">${escapeHtml(project.work_completed_to_date)}</p>
              </section>

              <section class="detail-panel">
                <p class="section-kicker">Next 30 days</p>
                <p class="card-text">${escapeHtml(project.next_30_day_goal)}</p>
              </section>
            </div>
          </div>

          <div class="support-list">
            <section class="detail-panel">
              <p class="section-kicker">Support needed from supervisor</p>
              <p class="support-text">${escapeHtml(project.support_needed_from_supervisor)}</p>
            </section>

            <section class="detail-panel funding-panel">
              <p class="section-kicker">Funding case for leadership</p>
              <p class="funding-text">${escapeHtml(project.funding_case_for_leadership)}</p>
            </section>
          </div>

          ${buildReviewWorkspace(project)}
        </article>
      `;
    })
    .join("");

  bindReviewControls(container);
}

function normalizeProject(project) {
  return Object.fromEntries(
    Object.entries(project).map(([key, value]) => [key, (value || "").trim()])
  );
}

function buildReviewWorkspace(project) {
  const reviewState = getReviewState(project);

  return `
    <section class="review-workspace" data-project-key="${escapeAttribute(getProjectKey(project))}">
      <div class="review-workspace-header">
        <div>
          <p class="section-kicker">Supervisor review</p>
        </div>
        <p class="review-saved-state" data-review-saved-state>${escapeHtml(formatSavedState(reviewState))}</p>
      </div>

      <div class="review-grid">
        <label class="review-field">
          <span class="review-label">Review status</span>
          <select class="review-select" data-review-field="reviewStatus">
            ${buildOptionMarkup(
              [
                "",
                "Pending review",
                "Reviewed",
                "Needs follow-up",
                "Blocked",
              ],
              reviewState.reviewStatus
            )}
          </select>
        </label>

        <label class="review-field">
          <span class="review-label">Approval</span>
          <select class="review-select" data-review-field="approvalStatus">
            ${buildOptionMarkup(
              [
                "",
                "Pending decision",
                "Approved",
                "Approved with edits",
                "Hold",
              ],
              reviewState.approvalStatus
            )}
          </select>
        </label>

        <label class="review-field">
          <span class="review-label">Next review date</span>
          <input
            class="review-input"
            data-review-field="nextReviewDate"
            type="date"
            value="${escapeAttribute(reviewState.nextReviewDate)}"
          />
        </label>
      </div>

      <label class="review-field review-field-full">
        <span class="review-label">Notes</span>
        <textarea class="review-textarea" data-review-field="notes" placeholder="Add review notes, approvals, blockers, or decisions.">${escapeHtml(reviewState.notes)}</textarea>
      </label>

      <div class="review-actions">
        <div class="review-action-group">
          <button class="review-button review-button-primary" type="button" data-review-save>
            Save review
          </button>
          <button class="review-button" type="button" data-review-clear>Clear</button>
        </div>
        <p class="review-hint">Saved in this browser only. Use export if you need to share or archive notes.</p>
      </div>
    </section>
  `;
}

function buildOptionMarkup(options, selectedValue) {
  return options
    .map((option) => {
      const label = option || "Select";
      const selected = option === selectedValue ? " selected" : "";

      return `<option value="${escapeAttribute(option)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join("");
}

function bindReviewControls(container) {
  const workspaces = container.querySelectorAll(".review-workspace");

  workspaces.forEach((workspace) => {
    const projectKey = workspace.dataset.projectKey;
    const project = state.projects.find((item) => getProjectKey(item) === projectKey);

    if (!project) {
      return;
    }

    const saveButton = workspace.querySelector("[data-review-save]");
    const clearButton = workspace.querySelector("[data-review-clear]");

    saveButton.addEventListener("click", () => {
      const reviewState = collectReviewState(workspace, project);
      try {
        localStorage.setItem(projectKey, JSON.stringify(reviewState));
        updateSavedState(workspace, reviewState);
      } catch (error) {
        console.error(error);
        workspace.querySelector("[data-review-saved-state]").textContent = "Could not save locally in this browser";
      }
    });

    clearButton.addEventListener("click", () => {
      try {
        localStorage.removeItem(projectKey);
      } catch (error) {
        console.error(error);
      }
      const defaultState = getDefaultReviewState(project);
      applyReviewState(workspace, defaultState);
      updateSavedState(workspace, defaultState);
    });
  });
}

function collectReviewState(workspace, project) {
  const defaultState = getDefaultReviewState(project);

  return {
    reviewStatus: workspace.querySelector('[data-review-field="reviewStatus"]').value.trim(),
    approvalStatus: workspace.querySelector('[data-review-field="approvalStatus"]').value.trim(),
    nextReviewDate: workspace.querySelector('[data-review-field="nextReviewDate"]').value.trim(),
    notes: workspace.querySelector('[data-review-field="notes"]').value.trim(),
    lastSaved: new Date().toISOString(),
    fallbackReviewStatus: defaultState.reviewStatus,
    fallbackApprovalStatus: defaultState.approvalStatus,
    fallbackNextReviewDate: defaultState.nextReviewDate,
    fallbackNotes: defaultState.notes,
  };
}

function applyReviewState(workspace, reviewState) {
  workspace.querySelector('[data-review-field="reviewStatus"]').value = reviewState.reviewStatus || "";
  workspace.querySelector('[data-review-field="approvalStatus"]').value = reviewState.approvalStatus || "";
  workspace.querySelector('[data-review-field="nextReviewDate"]').value = reviewState.nextReviewDate || "";
  workspace.querySelector('[data-review-field="notes"]').value = reviewState.notes || "";
}

function updateSavedState(workspace, reviewState) {
  const savedState = workspace.querySelector("[data-review-saved-state]");
  savedState.textContent = formatSavedState(reviewState);
}

function getDefaultReviewState(project) {
  return {
    reviewStatus: project.supervisor_review_status || "",
    approvalStatus: project.approval_status || "",
    nextReviewDate: project.next_review_date || "",
    notes: project.supervisor_notes || "",
    lastSaved: "",
  };
}

function getReviewState(project) {
  const projectKey = getProjectKey(project);
  const defaultState = getDefaultReviewState(project);

  try {
    const savedState = localStorage.getItem(projectKey);

    if (!savedState) {
      return defaultState;
    }

    return {
      ...defaultState,
      ...JSON.parse(savedState),
    };
  } catch (error) {
    console.error(error);
    return defaultState;
  }
}

function formatSavedState(reviewState) {
  if (reviewState.lastSaved) {
    return `Saved locally ${formatRelativeTime(reviewState.lastSaved)}`;
  }

  if (
    reviewState.reviewStatus ||
    reviewState.approvalStatus ||
    reviewState.nextReviewDate ||
    reviewState.notes
  ) {
    return "Pre-filled from tracker";
  }

  return "No review notes yet";
}

function formatRelativeTime(isoDate) {
  const timestamp = new Date(isoDate).getTime();

  if (Number.isNaN(timestamp)) {
    return "recently";
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes === 1) {
    return "1 minute ago";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours === 1) {
    return "1 hour ago";
  }

  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
}

function bindExportButton(button) {
  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    const exportRows = state.projects.map((project) => {
      const reviewState = getReviewState(project);

      return {
        project_title: project.project_title,
        current_status: project.current_status,
        review_status: reviewState.reviewStatus,
        approval_status: reviewState.approvalStatus,
        next_review_date: reviewState.nextReviewDate,
        supervisor_notes: reviewState.notes,
        last_saved: reviewState.lastSaved,
      };
    });

    const csv = toCsv(exportRows);
    downloadFile("supervisor-review-notes.csv", csv, "text/csv;charset=utf-8;");
  });
}

function getProjectKey(project) {
  return `supervisor-review:${project.project_title}`;
}

function formatUrlDisplay(urlValue) {
  try {
    const url = new URL(urlValue);
    const cleanPath = url.pathname.replace(/\/$/, "");
    const segments = cleanPath.split("/").filter(Boolean);

    if (!segments.length) {
      return url.hostname;
    }

    const shortPath = segments.length > 2 ? `${segments[0]}/${segments[1]}/...` : segments.join("/");
    return `${url.hostname}/${shortPath}`;
  } catch (error) {
    return urlValue.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

function getAccessMeta(accessValue) {
  if (!accessValue) {
    return "No public destination available yet";
  }

  if (/request early access/i.test(accessValue)) {
    return "Access is managed directly";
  }

  if (/private preview/i.test(accessValue)) {
    return "Not publicly accessible";
  }

  return "Reference link or access state";
}

function toCsv(rows) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  rows.forEach((row) => {
    const values = headers.map((header) => escapeCsvValue(row[header] || ""));
    lines.push(values.join(","));
  });

  return lines.join("\n");
}

function escapeCsvValue(value) {
  const stringValue = String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function parseCsv(csvText) {
  const rows = [];
  let currentValue = "";
  let currentRow = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }
      currentRow.push(currentValue);
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  const [headerRow, ...dataRows] = rows;

  return dataRows.map((row) => {
    const entry = {};

    headerRow.forEach((header, index) => {
      entry[header] = row[index] || "";
    });

    return entry;
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
