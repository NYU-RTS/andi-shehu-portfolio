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
        ? `<a class="project-url" href="${escapeAttribute(project.public_url_or_access)}" target="_blank" rel="noreferrer">Open output</a>`
        : `<span class="project-url is-muted">${escapeHtml(project.public_url_or_access || "No public URL")}</span>`;

      return `
        <article class="project-card">
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
              <p class="card-kicker">Current output</p>
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
        </article>
      `;
    })
    .join("");
}

function normalizeProject(project) {
  return Object.fromEntries(
    Object.entries(project).map(([key, value]) => [key, (value || "").trim()])
  );
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
