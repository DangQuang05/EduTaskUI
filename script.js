const pages = {
  dashboard: "Dashboard",
  tasks: "Công việc",
  groups: "Nhóm học",
  members: "Thành viên",
  notifications: "Thông báo",
  plans: "Gói đăng ký",
};

const breadcrumbs = {
  dashboard: "Xin chào 👋",
  tasks: "Quản lý công việc của bạn",
  groups: "Các nhóm học của bạn",
  members: "Chọn một nhóm để xem thành viên",
  profile: "Cập nhật thông tin cá nhân",
  notifications: "Thông báo từ hệ thống",
  plans: "Quản lý gói đăng ký",
};

const API_BASE = "http://localhost:8080/api";
let currentUser = null;
let currentGroups = [];
let currentTasks = [];
let currentUsers = [];
let currentTaskFilter = "all";
let activeGroupId = null;
let activeGroupName = "";
let currentNotifications = [];
let currentPlans = [];
let currentTransactions = [];
let currentActiveSubscription = null;
let currentActivities = [];
let paymentPollInterval = null;

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

async function apiRequest(url, options = {}, retry = true) {
  const token = localStorage.getItem("accessToken");

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (res.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return apiRequest(url, options, false);
    forceLogout();
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Có lỗi xảy ra");
  }

  return data;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || data?.success === false) return false;

    const auth = getData(data);
    if (!auth?.accessToken) return false;

    localStorage.setItem("accessToken", auth.accessToken);
    localStorage.setItem("refreshToken", auth.refreshToken || refreshToken);
    localStorage.setItem("user", JSON.stringify(auth));
    return true;
  } catch (error) {
    return false;
  }
}

function forceLogout() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

function getData(res) {
  return res?.data ?? res;
}

function showPage(name) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));

  const page = document.getElementById("page-" + name);
  if (page) page.classList.add("active");

  const pageTitle = document.getElementById("page-title");
  if (pageTitle) pageTitle.textContent = pages[name] || "EduTask";

  const breadcrumb = document.getElementById("page-breadcrumb");
  if (breadcrumb) breadcrumb.textContent = breadcrumbs[name] || "";

  document.querySelectorAll(".nav-item").forEach((btn) => {
    if (btn.getAttribute("onclick")?.includes(name))
      btn.classList.add("active");
  });
  function getPlanVisual(plan, index) {
    const visuals = [
      {
        theme: "plan-theme-basic",
        badges: ["Mới", "Tiết kiệm"],
        discount: 15,
        subtitle: "Phù hợp để bắt đầu trải nghiệm",
        highlight: false,
        bestValue: "",
      },
      {
        theme: "plan-theme-popular",
        badges: ["Hot", "Phổ biến", "Bán chạy"],
        discount: 30,
        subtitle: "Lựa chọn được nhiều người dùng nhất",
        highlight: true,
        bestValue: "BEST VALUE",
      },
      {
        theme: "plan-theme-premium",
        badges: ["Pro", "Nổi bật", "Ưu đãi lớn"],
        discount: 40,
        subtitle: "Tối ưu hiệu quả học nhóm và quản lý task",
        highlight: false,
        bestValue: "",
      },
      {
        theme: "plan-theme-elite",
        badges: ["VIP", "Cao cấp"],
        discount: 50,
        subtitle: "Trải nghiệm cao cấp với ưu đãi mạnh nhất",
        highlight: false,
        bestValue: "",
      },
    ];

    return visuals[index % visuals.length];
  }

  function buildPlanFeatures(plan) {
    const raw = (plan.features || "").trim();
    if (!raw) {
      return [
        "Quản lý công việc nhóm dễ dàng",
        "Theo dõi deadline nhanh chóng",
        "Nhận thông báo và cập nhật liên tục",
      ];
    }

    return raw
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);
  }

  function calculateOldPrice(price, discount) {
    const p = Number(price || 0);
    if (!p) return 0;
    return Math.round(p / (1 - discount / 100));
  }

  if (name === "dashboard") renderDashboard();
  if (name === "tasks") renderTasks(currentTaskFilter);
  if (name === "groups") renderGroups();
  if (name === "profile") renderProfile();
  if (name === "notifications") renderNotifications();
  if (name === "plans") renderPlans();
}

function filterTasks(el, type) {
  document
    .querySelectorAll(".filter-pill")
    .forEach((p) => p.classList.remove("active"));
  el.classList.add("active");
  currentTaskFilter = type;
  renderTasks(type);
}

function openLoginModal() {
  document.getElementById("login-modal")?.classList.add("open");
}

function closeLoginModal() {
  document.getElementById("login-modal")?.classList.remove("open");
}

function openRegisterModal() {
  document.getElementById("register-modal")?.classList.add("open");
}

function closeRegisterModal() {
  document.getElementById("register-modal")?.classList.remove("open");
}

function openModal() {
  document.getElementById("modal-create")?.classList.add("open");
  fillGroupSelects();
  const firstGroupId = document.getElementById("task-group-select")?.value;
  if (firstGroupId) loadMembersForTaskSelect(firstGroupId);
}

function openGroupModal() {
  document.getElementById("modal-create-group")?.classList.add("open");
}

function closeGroupModal() {
  document.getElementById("modal-create-group")?.classList.remove("open");
}

function openInviteMemberModal() {
  if (!activeGroupId) {
    alert("Vui lòng chọn một nhóm trước");
    return;
  }
  fillUserSelect();
  document.getElementById("modal-invite-member")?.classList.add("open");
}

function closeInviteMemberModal() {
  document.getElementById("modal-invite-member")?.classList.remove("open");
}

function closeModal() {
  document.getElementById("modal-create")?.classList.remove("open");
}

function openAssignModal() {
  document.getElementById("modal-assign")?.classList.add("open");
  fillGroupSelects();
}

function closeAssignModal() {
  document.getElementById("modal-assign")?.classList.remove("open");
}

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value.trim();

    if (!username || !password) {
      alert("Vui lòng nhập email và mật khẩu");
      return;
    }

    try {
      const res = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      const auth = getData(res);
      localStorage.setItem("accessToken", auth.accessToken);
      localStorage.setItem("refreshToken", auth.refreshToken || "");
      localStorage.setItem("user", JSON.stringify(auth));
      window.location.href = "dashboard.html";
    } catch (error) {
      alert(error.message || "Đăng nhập thất bại");
    }
  });
}

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fullName = document.getElementById("register-fullname")?.value.trim();
    const email = document.getElementById("register-email")?.value.trim();
    const password = document.getElementById("register-password")?.value.trim();
    const confirmPassword = document
      .getElementById("register-confirm-password")
      ?.value.trim();

    if (!fullName || !email || !password || !confirmPassword) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    if (password.length < 6) {
      alert("Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }

    if (password !== confirmPassword) {
      alert("Mật khẩu nhập lại không khớp");
      return;
    }

    try {
      const res = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password }),
      });

      const auth = getData(res);
      localStorage.setItem("accessToken", auth.accessToken);
      localStorage.setItem("refreshToken", auth.refreshToken || "");
      localStorage.setItem("user", JSON.stringify(auth));
      window.location.href = "dashboard.html";
    } catch (error) {
      alert(error.message || "Đăng ký thất bại");
    }
  });
}

async function logout() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch (error) {
    console.warn("Logout backend failed", error.message);
  }
  forceLogout();
  window.location.href = "index.html";
}

async function initDashboardPage() {
  const token = localStorage.getItem("accessToken");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    await loadCurrentUser();
    await Promise.all([
      loadGroups(),
      loadTasks(),
      loadUsers(),
      loadNotifications(),
      loadSubscriptions(),
      loadRecentActivities(),
    ]);
    fillGroupSelects();
    fillTaskGroupFilter();
    renderDashboard();
    renderGroups();
    renderTasks(currentTaskFilter);
    renderProfile();
    renderNotifications();
    renderPlans();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Không tải được dữ liệu", "error");
  }
}

async function refreshAllData() {
  try {
    await Promise.all([
      loadCurrentUser(),
      loadGroups(),
      loadTasks(),
      loadUsers(),
      loadNotifications(),
      loadSubscriptions(),
      loadRecentActivities(),
    ]);
    fillGroupSelects();
    fillTaskGroupFilter();
    renderDashboard();
    renderGroups();
    renderTasks(currentTaskFilter);
    renderProfile();
    renderNotifications();
    renderPlans();
    showToast("Đã làm mới dữ liệu", "success");
  } catch (error) {
    showToast(error.message || "Không làm mới được dữ liệu", "error");
  }
}

async function loadCurrentUser() {
  const res = await apiRequest("/users/me");
  currentUser = getData(res);

  const name = currentUser.fullName || currentUser.email || "Người dùng";
  const avatar = currentUser.avatarUrl ? null : getInitials(name);

  const breadcrumb = document.getElementById("page-breadcrumb");
  if (breadcrumb) breadcrumb.textContent = `Xin chào, ${name} 👋`;

  const userName = document.getElementById("current-user-name");
  if (userName) userName.textContent = name;

  const userRole = document.getElementById("current-user-role");
  if (userRole) userRole.textContent = currentUser.role || "Người dùng";

  const userAvatar = document.getElementById("current-user-avatar");
  if (userAvatar) userAvatar.textContent = avatar || "?";
}

async function loadGroups() {
  try {
    const res = await apiRequest("/groups/my");
    currentGroups = Array.isArray(getData(res)) ? getData(res) : [];
  } catch (error) {
    console.warn("Không tải được /groups/my, thử /groups", error.message);
    const res = await apiRequest("/groups");
    currentGroups = Array.isArray(getData(res)) ? getData(res) : [];
  }
}

async function loadTasks() {
  try {
    const res = await apiRequest("/tasks/my");
    currentTasks = Array.isArray(getData(res)) ? getData(res) : [];
  } catch (error) {
    console.warn("Không tải được /tasks/my, thử /tasks", error.message);
    const res = await apiRequest("/tasks");
    currentTasks = Array.isArray(getData(res)) ? getData(res) : [];
  }
}

async function loadUsers() {
  try {
    const res = await apiRequest("/users");
    currentUsers = Array.isArray(getData(res)) ? getData(res) : [];
  } catch (error) {
    console.warn("Không tải được danh sách users", error.message);
    currentUsers = currentUser ? [currentUser] : [];
  }
}

function renderDashboard() {
  const total = currentTasks.length;
  const completed = currentTasks.filter(isDone).length;
  const doing = currentTasks.filter(isDoing).length;

  setText("stat-total-tasks", total);
  setText("stat-completed-tasks", completed);
  setText("stat-doing-tasks", doing);
  setText("stat-total-groups", currentGroups.length);

  setText(
    "stat-total-tasks-desc",
    total ? "" : "Chưa có công việc",
  );
  setText(
    "stat-completed-tasks-desc",
    completed
      ? `${completed}/${total} công việc`
      : "Chưa hoàn thành công việc nào",
  );
  setText(
    "stat-doing-tasks-desc",
    doing ? `${doing} công việc đang làm` : "Chưa có công việc đang làm",
  );
  setText(
    "stat-total-groups-desc",
    currentGroups.length ? "Nhóm của tài khoản hiện tại" : "Chưa có nhóm",
  );
  setText("nav-task-count", total);

  const list = document.getElementById("dashboard-task-list");
  if (!list) return;
  list.innerHTML = "";

  const recentTasks = currentTasks.slice(0, 5);
  if (!recentTasks.length) {
    list.innerHTML = `<div class="empty-text">Chưa có công việc nào</div>`;
    return;
  }

  recentTasks.forEach((task) =>
    list.appendChild(createDashboardTaskItem(task)),
  );
  
  renderRecentActivities();
  renderDashboardContributions();
}

function createDashboardTaskItem(task) {
  const item = document.createElement("div");
  item.className = "task-item";
  item.innerHTML = `
    <div class="task-check ${isDone(task) ? "done" : ""}" onclick="updateTaskStatus(${task.taskId}, '${isDone(task) ? "TODO" : "DONE"}')"></div>
    <div class="task-content">
      <div class="task-name ${isDone(task) ? "done" : ""}">${escapeHtml(task.taskName || "Không có tên")}</div>
      <div class="task-meta">
        <span class="tag tag-blue">${escapeHtml(task.groupName || "Chưa có nhóm")}</span>
        <span>${formatDate(task.dueDate)}</span>
      </div>
    </div>
  `;
  return item;
}

async function loadRecentActivities() {
  try {
    const res = await apiRequest("/users/activities");
    currentActivities = Array.isArray(getData(res)) ? getData(res) : [];
  } catch (error) {
    console.warn("Không tải được hoạt động gần đây", error.message);
    currentActivities = [];
  }
}

function renderRecentActivities() {
  const list = document.getElementById("recent-activity-list");
  if (!list) return;
  list.innerHTML = "";

  if (!currentActivities.length) {
    list.innerHTML = `<div class="empty-text">Chưa có hoạt động nào</div>`;
    return;
  }

  currentActivities.forEach((act) => {
    const item = document.createElement("div");
    item.className = "activity-item";
    
    let dotChar = "⚡";
    let bg = "#eef2fd";
    let color = "#1a3ab0";
    
    const action = String(act.action).toUpperCase();
    if (action.includes("CREATE")) {
      dotChar = "+";
      bg = "#e8f5ee";
      color = "#1a7a4a";
    } else if (action.includes("DELETE")) {
      dotChar = "×";
      bg = "#fdf0f0";
      color = "#c13535";
    } else if (action.includes("LOGIN") || action.includes("REGISTER")) {
      dotChar = "👤";
      bg = "#f0ecfc";
      color = "#5b3fbf";
    } else if (action.includes("UPDATE")) {
      dotChar = "✎";
      bg = "#fdf3e3";
      color = "#9a5e10";
    }

    item.innerHTML = `
      <div class="activity-dot" style="background:${bg}; color:${color}; font-size:12px; display:flex; align-items:center; justify-content:center;">${dotChar}</div>
      <div class="activity-text"><strong>${escapeHtml(act.action)}</strong> – ${escapeHtml(act.description || "")}</div>
      <div class="activity-time">${formatDateTime(act.createdAt)}</div>
    `;
    list.appendChild(item);
  });
}

async function renderDashboardContributions() {
  const container = document.getElementById("contribution-list");
  if (!container) return;
  
  if (!currentGroups.length) {
    container.innerHTML = `<div class="empty-text">Bạn chưa tham gia nhóm nào</div>`;
    return;
  }
  
  const groupId = activeGroupId || currentGroups[0].groupId;
  const groupName = activeGroupName || currentGroups[0].groupName;
  
  container.innerHTML = `<div class="empty-text">Đang tải mức đóng góp của nhóm ${escapeHtml(groupName)}...</div>`;
  
  try {
    const res = await apiRequest(`/groups/${groupId}/members`);
    const members = Array.isArray(getData(res)) ? getData(res) : [];
    
    if (!members.length) {
      container.innerHTML = `<div class="empty-text">Nhóm chưa có thành viên</div>`;
      return;
    }
    
    container.innerHTML = `
      <div style="font-size:12px; color:var(--text2); margin-bottom:12px; font-weight:500;">
        Nhóm học: <strong>${escapeHtml(groupName)}</strong>
      </div>
      <div class="contrib-list" style="display:flex; flex-direction:column; gap:12px;"></div>
    `;
    
    const listDiv = container.querySelector(".contrib-list");
    
    members.forEach(member => {
      const score = member.contributionScore || 0;
      const barPercent = Math.min(score, 100);
      
      const item = document.createElement("div");
      item.className = "contrib-item";
      item.innerHTML = `
        <div class="contrib-top" style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <span class="contrib-name" style="font-weight:500;">${escapeHtml(member.fullName || member.email)}</span>
          <span class="contrib-pct" style="font-family:monospace; color:var(--accent); font-weight:600;">${score} điểm</span>
        </div>
        <div class="contrib-bar" style="height:6px; background:var(--surface2); border-radius:3px; overflow:hidden;">
          <div class="contrib-fill" style="width:${barPercent}%; height:100%; background:var(--accent); border-radius:3px; transition:width 0.4s ease;"></div>
        </div>
      `;
      listDiv.appendChild(item);
    });
  } catch (error) {
    console.warn("Không tải được mức đóng góp", error.message);
    container.innerHTML = `<div class="empty-text" style="color:var(--red)">Lỗi tải mức đóng góp</div>`;
  }
}

function renderTasks(filter = "all") {
  const lists = {
    todo: document.getElementById("todo-tasks"),
    doing: document.getElementById("doing-tasks"),
    done: document.getElementById("done-tasks"),
  };

  Object.values(lists).forEach((list) => {
    if (list) list.innerHTML = "";
  });

  const filteredTasks = getFilteredTasks();
  const todoTasks = filteredTasks.filter((t) => !isDone(t) && !isDoing(t));
  const doingTasks = filteredTasks.filter(isDoing);
  const doneTasks = filteredTasks.filter(isDone);

  setText("todo-tasks-count", todoTasks.length);
  setText("doing-tasks-count", doingTasks.length);
  setText("done-tasks-count", doneTasks.length);

  renderTaskColumn(
    lists.todo,
    filter === "all" || filter === "todo" ? todoTasks : [],
  );
  renderTaskColumn(
    lists.doing,
    filter === "all" || filter === "doing" ? doingTasks : [],
  );
  renderTaskColumn(
    lists.done,
    filter === "all" || filter === "done" ? doneTasks : [],
  );
}

function getFilteredTasks() {
  const search =
    document.getElementById("task-search-input")?.value.trim().toLowerCase() ||
    "";
  const groupId = document.getElementById("task-group-filter")?.value || "";

  return currentTasks.filter((task) => {
    const matchesSearch =
      !search ||
      [task.taskName, task.groupName, task.assigneeName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    const matchesGroup = !groupId || String(task.groupId) === String(groupId);
    return matchesSearch && matchesGroup;
  });
}

function clearTaskFilters() {
  const search = document.getElementById("task-search-input");
  const groupFilter = document.getElementById("task-group-filter");
  if (search) search.value = "";
  if (groupFilter) groupFilter.value = "";
  renderTasks(currentTaskFilter);
}

function renderTaskColumn(container, tasks) {
  if (!container) return;
  container.innerHTML = "";

  if (!tasks.length) {
    container.innerHTML = `<div class="empty-text">Chưa có công việc nào</div>`;
    return;
  }

  tasks.forEach((task) => {
    const card = document.createElement("div");
    card.className = "kanban-task";
    card.innerHTML = `
      <div class="kanban-task-name">${escapeHtml(task.taskName || "Không có tên")}</div>
      <div class="task-meta" style="margin-bottom: 10px">
        <span class="tag tag-blue">${escapeHtml(task.groupName || "Chưa có nhóm")}</span>
        <span class="tag ${isDone(task) ? "tag-green" : isDoing(task) ? "tag-amber" : "tag-gray"}">${statusText(task.status)}</span>
      </div>
      <div class="kanban-task-footer">
        <div class="kanban-task-due">${formatDate(task.dueDate)}</div>
        <div class="mini-avatar" style="background: #eef2fd; color: #1a3ab0">${getInitials(task.assigneeName || currentUser?.fullName || "?")}</div>
      </div>
      <div class="task-actions">
        ${isDoing(task) || isDone(task) ? `<button class="mini-btn" onclick="updateTaskStatus(${task.taskId}, 'TODO')">Chưa làm</button>` : `<button class="mini-btn" onclick="updateTaskStatus(${task.taskId}, 'DOING')">Bắt đầu</button>`}
        ${isDone(task) ? "" : `<button class="mini-btn success" onclick="updateTaskStatus(${task.taskId}, 'DONE')">Xong</button>`}
        <button class="mini-btn danger" onclick="deleteTask(${task.taskId})">Xóa</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderGroups() {
  const sidebar = document.getElementById("sidebar-groups-list");
  const groupsList = document.getElementById("groups-list");

  if (sidebar) {
    sidebar.innerHTML = "";
    if (!currentGroups.length) {
      sidebar.innerHTML = `<div class="empty-text">Chưa có nhóm nào</div>`;
    } else {
      currentGroups.forEach((group) => {
        const item = document.createElement("div");
        item.className = "group-item";
        item.onclick = () => openMembers(group.groupId, group.groupName);
        item.innerHTML = `<span class="group-dot"></span><span class="group-name">${escapeHtml(group.groupName || "Nhóm không tên")}</span>`;
        sidebar.appendChild(item);
      });
    }
  }

  if (!groupsList) return;
  groupsList.innerHTML = "";

  if (!currentGroups.length) {
    groupsList.innerHTML = `<div class="empty-text">Chưa có nhóm học nào</div>`;
    return;
  }

  currentGroups.forEach((group) => {
    const progress = Number(group.progress || 0);
    const card = document.createElement("div");
    card.className = "group-card";
    card.onclick = () => openMembers(group.groupId, group.groupName);
    card.innerHTML = `
      <div class="group-card-header">
        <div class="group-card-color" style="background: var(--accent-bg)">
          <svg fill="none" viewBox="0 0 24 24" stroke="var(--accent)" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div class="group-card-name">${escapeHtml(group.groupName || "Nhóm không tên")}</div>
        <div class="group-card-subject">${escapeHtml(group.status || "Đang hoạt động")}</div>
      </div>
      <div class="group-card-body">
        <div class="group-card-meta">
          <div class="group-meta-item">${group.membersCount || 0} thành viên</div>
          <div class="group-meta-item">${group.totalTasks || 0} nhiệm vụ</div>
        </div>
        <div class="group-progress">
          <div class="group-progress-fill" style="width: ${progress}%; background: var(--accent)"></div>
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:6px;">
          <span style="font-size:11.5px; color:var(--text3)">${progress}% hoàn thành</span>
          <span style="font-size:11.5px; color:var(--text3)">Hạn: ${formatDate(group.deadline)}</span>
        </div>
        <div class="card-actions-row">
          <button class="mini-btn" onclick="event.stopPropagation(); openMembers(${group.groupId}, '${escapeJs(group.groupName || "Nhóm")}')">Xem thành viên</button>
          <button class="mini-btn danger" onclick="event.stopPropagation(); deleteGroup(${group.groupId})">Xóa nhóm</button>
        </div>
      </div>
    `;
    groupsList.appendChild(card);
  });
}

async function openMembers(groupId, groupName = "") {
  activeGroupId = groupId;
  activeGroupName = groupName;
  showPage("members");
  setText("members-title", `Thành viên – ${groupName || "Nhóm"}`);

  const tbody = document.getElementById("members-list");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px;">Đang tải thành viên...</td></tr>`;

  try {
    const res = await apiRequest(`/groups/${groupId}/members`);
    const members = Array.isArray(getData(res)) ? getData(res) : [];
    renderMembers(members);
  } catch (error) {
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px;">${escapeHtml(error.message)}</td></tr>`;
  }
}

function renderMembers(members) {
  const tbody = document.getElementById("members-list");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px;">Nhóm này chưa có thành viên</td></tr>`;
    return;
  }

  members.forEach((member) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="member-cell">
          <div class="member-avatar" style="background:#eef2fd; color:#1a3ab0">${getInitials(member.fullName || member.email || "?")}</div>
          <div>
            <div class="member-full-name">${escapeHtml(member.fullName || "Không có tên")}</div>
            <div class="member-email">${escapeHtml(member.email || "")}</div>
          </div>
        </div>
      </td>
      <td><span class="role-badge tag tag-blue">${escapeHtml(member.role || "Thành viên")}</span></td>
      <td><span style="font-family:'DM Mono', monospace; font-size:13px;">-</span></td>
      <td>
        <div class="score-bar-wrap">
          <div class="score-bar"><div class="score-fill" style="width:${member.contributionScore || 0}%; background:var(--accent)"></div></div>
          <span class="score-num">${member.contributionScore || 0}</span>
        </div>
      </td>
      <td><span class="tag tag-green">Hoạt động</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function fillGroupSelects() {
  const selects = [
    document.getElementById("task-group-select"),
    document.getElementById("assign-group-select"),
  ].filter(Boolean);

  selects.forEach((select) => {
    select.innerHTML = `<option value="">Chọn nhóm</option>`;
    currentGroups.forEach((group) => {
      const option = document.createElement("option");
      option.value = group.groupId;
      option.textContent = group.groupName;
      select.appendChild(option);
    });
  });

  const taskGroupSelect = document.getElementById("task-group-select");
  if (taskGroupSelect?.value) loadMembersForTaskSelect(taskGroupSelect.value);
}

function fillTaskGroupFilter() {
  const select = document.getElementById("task-group-filter");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `<option value="">Tất cả nhóm</option>`;
  currentGroups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.groupId;
    option.textContent = group.groupName;
    select.appendChild(option);
  });
  if (currentValue) select.value = currentValue;
}

function fillUserSelect() {
  const select = document.getElementById("invite-user-select");
  if (!select) return;
  select.innerHTML = `<option value="">Chọn thành viên</option>`;
  currentUsers
    .filter((user) => user.userId !== currentUser?.userId)
    .forEach((user) => {
      const option = document.createElement("option");
      option.value = user.userId;
      option.textContent = `${user.fullName || user.email} (${user.email})`;
      select.appendChild(option);
    });
}

async function loadMembersForTaskSelect(groupId) {
  const select = document.getElementById("task-assignee-select");
  if (!select) return;
  select.innerHTML = `<option value="">Giao cho tôi</option>`;

  if (!groupId) return;

  try {
    const res = await apiRequest(`/groups/${groupId}/members`);
    const members = Array.isArray(getData(res)) ? getData(res) : [];
    members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.userId;
      option.textContent = member.fullName || member.email;
      select.appendChild(option);
    });
  } catch (error) {
    console.warn("Không tải được thành viên nhóm", error.message);
  }
}

async function createGroup() {
  const groupName = document.getElementById("group-name")?.value.trim();
  const deadline = document.getElementById("group-deadline")?.value;

  if (!groupName) {
    showToast("Vui lòng nhập tên nhóm", "error");
    return;
  }

  try {
    await apiRequest("/groups", {
      method: "POST",
      body: JSON.stringify({
        groupName,
        deadline: deadline ? `${deadline}T23:59:00` : null,
      }),
    });

    document.getElementById("group-name").value = "";
    document.getElementById("group-deadline").value = "";
    closeGroupModal();
    await loadGroups();
    fillGroupSelects();
    fillTaskGroupFilter();
    renderDashboard();
    renderGroups();
    showToast("🎉 Tạo nhóm thành công!", "success");
  } catch (error) {
    showToast(error.message || "Không tạo được nhóm", "error");
  }
}

async function addMemberToCurrentGroup() {
  const userId = document.getElementById("invite-user-select")?.value;
  const role = document.getElementById("invite-role-select")?.value || "MEMBER";

  if (!activeGroupId) {
    showToast("Vui lòng chọn nhóm trước", "error");
    return;
  }

  if (!userId) {
    showToast("Vui lòng chọn thành viên", "error");
    return;
  }

  try {
    await apiRequest(
      `/groups/${activeGroupId}/members?userId=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}`,
      {
        method: "POST",
      },
    );

    closeInviteMemberModal();
    await loadGroups();
    await openMembers(activeGroupId, activeGroupName);
    renderGroups();
    showToast("👤 Thêm thành viên thành công!", "success");
  } catch (error) {
    showToast(error.message || "Không thêm được thành viên", "error");
  }
}

async function createTask() {
  const taskName = document.getElementById("task-title")?.value.trim();
  const groupId = document.getElementById("task-group-select")?.value;
  const selectedAssigneeId =
    document.getElementById("task-assignee-select")?.value || null;
  const assigneeId = selectedAssigneeId || currentUser?.userId || null;
  const date = document.getElementById("task-deadline")?.value;

  if (!taskName || !groupId) {
    showToast("Vui lòng nhập tên công việc và chọn nhóm", "error");
    return;
  }

  const body = {
    taskName,
    groupId: Number(groupId),
    assigneeId: assigneeId ? Number(assigneeId) : null,
    dueDate: date ? `${date}T23:59:00` : null,
    status: "TODO",
  };

  try {
    await apiRequest("/tasks", {
      method: "POST",
      body: JSON.stringify(body),
    });

    closeModal();
    document.getElementById("task-title").value = "";
    document.getElementById("task-description").value = "";
    document.getElementById("task-deadline").value = "";
    await Promise.all([loadTasks(), loadGroups()]);
    fillTaskGroupFilter();
    renderDashboard();
    renderTasks(currentTaskFilter);
    renderGroups();
    showToast("✅ Tạo công việc thành công!", "success");
  } catch (error) {
    showToast(error.message || "Không tạo được công việc", "error");
  }
}

async function updateTaskStatus(taskId, status) {
  try {
    await apiRequest(
      `/tasks/${taskId}/status?status=${encodeURIComponent(status)}`,
      { method: "PUT" },
    );
    await loadTasks();
    renderDashboard();
    renderTasks(currentTaskFilter);
  } catch (error) {
    alert(error.message || "Không cập nhật được trạng thái");
  }
}

async function deleteTask(taskId) {
  if (!confirm("Xóa công việc này?")) return;
  try {
    await apiRequest(`/tasks/${taskId}`, { method: "DELETE" });
    await Promise.all([loadTasks(), loadGroups()]);
    renderDashboard();
    renderTasks(currentTaskFilter);
    renderGroups();
    showToast("Đã xóa công việc");
  } catch (error) {
    alert(error.message || "Không xóa được công việc");
  }
}

async function deleteGroup(groupId) {
  if (
    !confirm(
      "Xóa nhóm này? Các công việc trong nhóm có thể không còn hiển thị.",
    )
  )
    return;
  try {
    await apiRequest(`/groups/${groupId}`, { method: "DELETE" });
    if (String(activeGroupId) === String(groupId)) {
      activeGroupId = null;
      activeGroupName = "";
      setText("members-title", "Thành viên");
      const tbody = document.getElementById("members-list");
      if (tbody)
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px;">Chọn một nhóm để xem thành viên</td></tr>`;
    }
    await Promise.all([loadGroups(), loadTasks()]);
    fillGroupSelects();
    fillTaskGroupFilter();
    renderDashboard();
    renderGroups();
    renderTasks(currentTaskFilter);
    showToast("Đã xóa nhóm");
  } catch (error) {
    alert(error.message || "Không xóa được nhóm");
  }
}

async function loadNotifications() {
  try {
    const res = await apiRequest("/notifications");
    currentNotifications = Array.isArray(getData(res)) ? getData(res) : [];
    await loadUnreadNotificationCount();
  } catch (error) {
    console.warn("Không tải được thông báo", error.message);
    currentNotifications = [];
    setText("nav-notification-count", 0);
  }
}

async function loadUnreadNotificationCount() {
  try {
    const res = await apiRequest("/notifications/unread-count");
    const data = getData(res) || {};
    setText("nav-notification-count", data.count || 0);
  } catch (error) {
    const count = currentNotifications.filter(
      (n) => !n.read && !n.isRead,
    ).length;
    setText("nav-notification-count", count);
  }
}

async function loadSubscriptions() {
  await Promise.all([
    loadPlans(),
    loadActiveSubscription(),
    loadTransactions(),
  ]);
}

async function loadPlans() {
  try {
    const res = await apiRequest("/subscriptions/plans");
    currentPlans = Array.isArray(getData(res)) ? getData(res) : [];
  } catch (error) {
    console.warn("Không tải được danh sách gói", error.message);
    currentPlans = [];
  }
}

async function loadActiveSubscription() {
  try {
    const res = await apiRequest("/subscriptions/active");
    currentActiveSubscription = getData(res) || null;
  } catch (error) {
    console.warn("Không tải được gói hiện tại", error.message);
    currentActiveSubscription = null;
  }
}

async function loadTransactions() {
  try {
    const res = await apiRequest("/subscriptions/transactions");
    currentTransactions = Array.isArray(getData(res)) ? getData(res) : [];
  } catch (error) {
    console.warn("Không tải được giao dịch", error.message);
    currentTransactions = [];
  }
}

function renderProfile() {
  if (!currentUser) return;
  const fields = {
    "profile-fullname": currentUser.fullName || "",
    "profile-email": currentUser.email || "",
    "profile-avatar": currentUser.avatarUrl || "",
    "profile-skills": currentUser.skills || "",
    "profile-availability": currentUser.availability || "",
  };
  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = value;
  });
}

async function updateProfile() {
  const fullName = document.getElementById("profile-fullname")?.value.trim();
  const avatarUrl = document.getElementById("profile-avatar")?.value.trim();
  const skills = document.getElementById("profile-skills")?.value.trim();
  const availability = document
    .getElementById("profile-availability")
    ?.value.trim();

  if (!fullName) {
    showToast("Vui lòng nhập họ tên", "error");
    return;
  }

  try {
    const res = await apiRequest("/users/profile", {
      method: "PUT",
      body: JSON.stringify({ fullName, avatarUrl, skills, availability }),
    });
    currentUser = getData(res);
    await loadCurrentUser();
    renderProfile();
    showToast("💾 Cập nhật hồ sơ thành công!", "success");
  } catch (error) {
    showToast(error.message || "Không cập nhật được hồ sơ", "error");
  }
}

async function deleteMyAccount() {
  if (!confirm("Bạn chắc chắn muốn vô hiệu hóa tài khoản này?")) return;
  try {
    await apiRequest("/users/me", { method: "DELETE" });
    forceLogout();
    alert("Tài khoản đã được vô hiệu hóa");
    window.location.href = "index.html";
  } catch (error) {
    alert(error.message || "Không xóa được tài khoản");
  }
}

function renderNotifications() {
  const list = document.getElementById("notifications-list");
  if (!list) return;
  list.innerHTML = "";

  if (!currentNotifications.length) {
    list.innerHTML = `<div class="empty-text">Chưa có thông báo nào</div>`;
    return;
  }

  currentNotifications.forEach((notification) => {
    const isRead = notification.read ?? notification.isRead;
    const item = document.createElement("div");
    item.className = "activity-item";
    item.innerHTML = `
      <div class="activity-dot" style="background:${isRead ? "#f3f3f3" : "#eef2fd"}; color:${isRead ? "#777" : "#1a3ab0"}; font-size:11px">${isRead ? "✓" : "!"}</div>
      <div class="activity-text">${escapeHtml(notification.content || "Thông báo")}</div>
      <div class="activity-time">${formatDateTime(notification.createdAt)}</div>
      ${isRead ? "" : `<button class="btn btn-ghost" style="padding:4px 8px;font-size:11px" onclick="markNotificationRead(${notification.notificationId})">Đã đọc</button>`}
    `;
    list.appendChild(item);
  });
}

async function markNotificationRead(id) {
  try {
    await apiRequest(`/notifications/${id}/read`, { method: "PUT" });
    await loadNotifications();
    renderNotifications();
  } catch (error) {
    alert(error.message || "Không cập nhật được thông báo");
  }
}

async function markAllNotificationsRead() {
  try {
    await apiRequest("/notifications/read-all", { method: "PUT" });
    await loadNotifications();
    renderNotifications();
  } catch (error) {
    alert(error.message || "Không cập nhật được thông báo");
  }
}

function renderPlans() {
  renderActiveSubscription();
  renderPlanCards();
  renderTransactions();
}

function renderActiveSubscription() {
  const box = document.getElementById("active-subscription-box");
  if (!box) return;

  if (!currentActiveSubscription) {
    box.innerHTML = `<div class="empty-text">Chưa có gói đăng ký</div>`;
    return;
  }

  box.innerHTML = `
    <div class="active-plan-box">
      <div class="active-plan-top">
        <div>
          <div class="active-plan-status">✨ ĐANG SỬ DỤNG</div>
          <div class="active-plan-title">
            ${escapeHtml(currentActiveSubscription.planName || "Gói hiện tại")}
          </div>
          <div class="active-plan-price">
            ${formatMoney(currentActiveSubscription.price, currentActiveSubscription.currency)}
            <span>/ gói</span>
          </div>
        </div>
        <div class="active-plan-chip">
          Hết hạn: ${formatDate(currentActiveSubscription.endDate)}
        </div>
      </div>

      <div class="active-plan-meta">
        <div class="active-plan-chip">Trạng thái: ${escapeHtml(currentActiveSubscription.status || "ACTIVE")}</div>
        <div class="active-plan-chip">Thanh toán thành công</div>
        <div class="active-plan-chip">Ưu đãi đang áp dụng</div>
      </div>

      <div class="active-plan-desc">
        ${escapeHtml(currentActiveSubscription.features || "Bạn đang sử dụng gói dịch vụ để quản lý học nhóm hiệu quả hơn.")}
      </div>
    </div>
  `;
}

function renderPlanCards() {
  const list = document.getElementById("plans-list");
  if (!list) return;

  list.innerHTML = "";

  if (!currentPlans || !currentPlans.length) {
    list.innerHTML = `<div class="empty-text">Backend chưa có gói nào trong database</div>`;
    return;
  }

  currentPlans.forEach((plan, index) => {
    const price = Number(plan.price || 0);
    const durationDays = plan.durationDays || 0;
    const currency = plan.currency || "VND";

    const visuals = [
      {
        theme: "plan-theme-basic",
        badges: ["Mới", "Tiết kiệm"],
        discount: 15,
        subtitle: "Phù hợp để bắt đầu trải nghiệm",
        bestValue: "",
      },
      {
        theme: "plan-theme-popular",
        badges: ["Hot", "Phổ biến", "Bán chạy"],
        discount: 30,
        subtitle: "Lựa chọn được nhiều người dùng nhất",
        bestValue: "BEST VALUE",
      },
      {
        theme: "plan-theme-premium",
        badges: ["Pro", "Ưu đãi lớn"],
        discount: 40,
        subtitle: "Tối ưu học nhóm và quản lý task",
        bestValue: "",
      },
      {
        theme: "plan-theme-elite",
        badges: ["VIP", "Cao cấp"],
        discount: 50,
        subtitle: "Trải nghiệm cao cấp nhất",
        bestValue: "",
      },
    ];

    const visual = visuals[index % visuals.length];
    const oldPrice =
      price > 0 ? Math.round(price / (1 - visual.discount / 100)) : 0;

    const rawFeatures = plan.features || "";
    const features = rawFeatures
      ? rawFeatures
          .split(/[,;\n]+/)
          .map((item) => item.trim())
          .filter(Boolean)
      : [
          "Quản lý công việc nhóm dễ dàng",
          "Theo dõi deadline nhanh chóng",
          "Nhận thông báo và cập nhật liên tục",
        ];

    const card = document.createElement("div");
    card.className = `plan-card ${visual.theme} ${index === 1 ? "plan-highlight-ring" : ""}`;

    card.innerHTML = `
      ${visual.bestValue ? `<div class="plan-best-value">${visual.bestValue}</div>` : ""}

      <div class="plan-badges">
        ${visual.badges.map((badge) => `<span class="plan-badge">${badge}</span>`).join("")}
      </div>

      <div class="plan-name">${escapeHtml(plan.planName || "Gói đăng ký")}</div>
      <div class="plan-sub">${escapeHtml(visual.subtitle)}</div>

      <div class="plan-discount-wrap">
        <div>
          <div class="plan-discount-big">-${visual.discount}%</div>
          <div class="plan-discount-label">Ưu đãi nổi bật</div>
        </div>

        <div class="plan-price-box">
          <div class="plan-old-price">
            ${oldPrice ? formatMoney(oldPrice, currency) : ""}
          </div>
          <div class="plan-price">
            ${formatMoney(price, currency)}
          </div>
          <div class="plan-price-unit">/ ${durationDays} ngày</div>
        </div>
      </div>

      <div class="plan-meta-row">
        <span class="plan-meta-chip">${durationDays} ngày sử dụng</span>
        <span class="plan-meta-chip">${escapeHtml(currency)}</span>
        <span class="plan-meta-chip">Kích hoạt nhanh</span>
      </div>

      <div class="plan-feature-list">
        ${features
          .slice(0, 4)
          .map(
            (feature) => `
          <div class="plan-feature">
            <span class="plan-feature-icon">✓</span>
            <span>${escapeHtml(feature)}</span>
          </div>
        `,
          )
          .join("")}
      </div>

      <button class="plan-cta" onclick="subscribePlan(${plan.planId}, ${price})">
        Đăng ký ngay
      </button>
    `;

    list.appendChild(card);
  });
}
function closePaymentModal() {
  document.getElementById("modal-payment")?.classList.remove("open");
  if (paymentPollInterval) {
    clearInterval(paymentPollInterval);
    paymentPollInterval = null;
  }
}

async function subscribePlan(planId, amount) {
  const plan = currentPlans.find(p => p.planId === planId);
  const planName = plan ? plan.planName : "Gói dịch vụ";
  const userId = currentUser ? currentUser.userId : "0";
  
  // Tạo nội dung chuyển khoản tự động không có dấu cách
  const description = `EDUTASKSUB${planId}USER${userId}`.toUpperCase();
  
  // Tạo VietQR Image URL
  const bankId = "MB";
  const accountNo = "00160920049999";
  const template = "compact2";
  const accountName = "PHAM NGUYEN KIEN";
  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;
  
  const qrImg = document.getElementById("payment-qr-image");
  const pName = document.getElementById("payment-plan-name");
  const pAmount = document.getElementById("payment-amount");
  const pDesc = document.getElementById("payment-description");
  
  if (qrImg) qrImg.src = qrUrl;
  if (pName) pName.textContent = planName;
  if (pAmount) pAmount.textContent = formatMoney(amount, plan?.currency || "VND");
  if (pDesc) pDesc.textContent = description;
  
  const modal = document.getElementById("modal-payment");
  if (modal) modal.classList.add("open");
  
  // 1. Dọn dẹp polling cũ nếu có
  if (paymentPollInterval) clearInterval(paymentPollInterval);
  
  // Ghi nhận các mốc so sánh hiện tại của gói đang hoạt động
  const initialSubId = currentActiveSubscription ? currentActiveSubscription.subscriptionId : null;
  const initialPlanId = currentActiveSubscription ? currentActiveSubscription.planId : null;
  const initialEndDate = currentActiveSubscription ? currentActiveSubscription.endDate : null;
  
  async function checkPaymentStatus() {
    try {
      const res = await apiRequest("/subscriptions/active");
      const activeSub = getData(res);
      
      let isChanged = false;
      if (!initialSubId && activeSub) {
        isChanged = true;
      } else if (activeSub && (activeSub.subscriptionId !== initialSubId || activeSub.planId !== initialPlanId || activeSub.endDate !== initialEndDate)) {
        isChanged = true;
      }
      
      if (isChanged) {
        if (paymentPollInterval) {
          clearInterval(paymentPollInterval);
          paymentPollInterval = null;
        }
        currentActiveSubscription = activeSub;
        closePaymentModal();
        await loadSubscriptions();
        renderPlans();
        showToast(`🎉 Thanh toán thành công! Gói ${activeSub.planName} đã được tự động kích hoạt!`, "success");
        return true;
      }
    } catch (err) {
      console.warn("Lỗi kiểm tra trạng thái thanh toán:", err.message);
    }
    return false;
  }
  
  // 2. Khởi chạy vòng lặp check thanh toán tự động (mỗi 3 giây)
  paymentPollInterval = setInterval(async () => {
    await checkPaymentStatus();
  }, 3000);
  
  const confirmBtn = document.getElementById("confirm-payment-btn");
  if (confirmBtn) {
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    
    // Nút này kích hoạt kiểm tra thủ công tức thì, không tự động tạo gói khống nữa
    newConfirmBtn.addEventListener("click", async () => {
      newConfirmBtn.disabled = true;
      newConfirmBtn.textContent = "Đang kiểm tra...";
      
      const success = await checkPaymentStatus();
      if (!success) {
        showToast("Hệ thống chưa ghi nhận được thanh toán của bạn. Vui lòng chờ 5-10 giây sau khi chuyển khoản và thử lại.", "info");
      }
      
      newConfirmBtn.disabled = false;
      newConfirmBtn.textContent = "Xác nhận chuyển khoản";
    });
  }
}

function renderTransactions() {
  const list = document.getElementById("transactions-list");
  if (!list) return;
  list.innerHTML = "";

  if (!currentTransactions.length) {
    list.innerHTML = `<div class="empty-text">Chưa có giao dịch nào</div>`;
    return;
  }

  currentTransactions.forEach((transaction) => {
    const item = document.createElement("div");
    item.className = "activity-item";
    item.innerHTML = `
      <div class="activity-dot" style="background:#e8f5ee; color:#1a7a4a; font-size:11px">$</div>
      <div class="activity-text"><strong>${escapeHtml(transaction.planName || "Gói")}</strong> – ${formatMoney(transaction.amount, "VND")} – ${escapeHtml(transaction.paymentMethod || "")}</div>
      <div class="activity-time">${formatDateTime(transaction.createdAt)}</div>
      <span class="tag tag-green">${escapeHtml(transaction.status || "SUCCESS")}</span>
    `;
    list.appendChild(item);
  });
}

async function applyAssign() {
  const groupId = document.getElementById("assign-group-select")?.value;
  const resultList = document.getElementById("assign-result-list");

  if (!groupId) {
    alert("Vui lòng chọn nhóm trước khi phân công tự động");
    return;
  }

  if (resultList) {
    resultList.innerHTML = `<div class="empty-text">Đang phân công tự động...</div>`;
  }

  try {
    if (!currentTasks || currentTasks.length === 0) {
      await loadTasks();
    }

    const tasksInGroup = currentTasks.filter((task) => {
      const sameGroup = String(task.groupId) === String(groupId);
      const notDone = !isDone(task);
      return sameGroup && notDone;
    });

    if (!tasksInGroup.length) {
      if (resultList) {
        resultList.innerHTML = `<div class="empty-text">Nhóm này chưa có công việc cần phân công</div>`;
      }
      return;
    }

    const assignedResults = [];

    for (const task of tasksInGroup) {
      const assignedTask = await apiRequest(
        `/assignments/tasks/${task.taskId}/auto-assign`,
        {
          method: "POST",
        },
      );

      assignedResults.push(getData(assignedTask));
    }

    if (resultList) {
      resultList.innerHTML = assignedResults
        .map((task) => {
          const assigneeName =
            task.assignee?.fullName ||
            task.assigneeName ||
            `User ID ${task.assigneeId || task.assignee?.userId || "?"}`;

          return `
          <div style="
            background: #fff;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px;
          ">
            <div style="font-weight: 700; color: var(--text); margin-bottom: 4px;">
              ${escapeHtml(task.taskName || "Công việc")}
            </div>
            <div style="font-size: 12px; color: var(--text2);">
              Đã giao cho: <strong>${escapeHtml(assigneeName)}</strong>
            </div>
            <div style="font-size: 12px; color: var(--accent-text); margin-top: 4px;">
              Điểm phù hợp: ${task.assignmentScore || "?"}/100
            </div>
            <div style="font-size: 12px; color: var(--text2); margin-top: 4px;">
              ${escapeHtml(task.assignmentReason || "Đã phân công tự động thành công.")}
            </div>
          </div>
        `;
        })
        .join("");
    }

    await loadTasks();
    renderDashboard();
    renderTasks(currentTaskFilter);

    alert("Phân công tự động thành công!");
  } catch (error) {
    console.error(error);
    if (resultList) {
      resultList.innerHTML = `
        <div class="empty-text" style="color: red;">
          Lỗi phân công: ${escapeHtml(error.message || "Không thể phân công tự động")}
        </div>
      `;
    }
    alert(error.message || "Không thể phân công tự động");
  }
}

function isDone(task) {
  return ["DONE", "COMPLETED", "HOAN_THANH"].includes(
    String(task.status || "").toUpperCase(),
  );
}

function isDoing(task) {
  return ["DOING", "IN_PROGRESS", "PROCESSING", "DANG_LAM"].includes(
    String(task.status || "").toUpperCase(),
  );
}

function statusText(status) {
  const s = String(status || "TODO").toUpperCase();
  if (["DONE", "COMPLETED", "HOAN_THANH"].includes(s)) return "Hoàn thành";
  if (["DOING", "IN_PROGRESS", "PROCESSING", "DANG_LAM"].includes(s))
    return "Đang làm";
  return "Chưa làm";
}

function formatDate(value) {
  if (!value) return "Chưa có hạn";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có hạn";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value, currency = "VND") {
  const amount = Number(value || 0);
  try {
    return amount.toLocaleString("vi-VN") + " " + (currency || "VND");
  } catch (e) {
    return `${amount} ${currency || "VND"}`;
  }
}

function getInitials(name = "") {
  return (
    String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "?"
  );
}

function escapeJs(value = "") {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"');
}

function showToast(message, type = "success") {
  const notif = document.createElement("div");
  let bg = "rgba(15, 23, 42, 0.85)";
  let borderColor = "rgba(255, 255, 255, 0.1)";
  let glowColor = "rgba(255, 255, 255, 0.05)";
  let icon = "✨";
  if (type === "success") {
    borderColor = "rgba(16, 185, 129, 0.4)";
    glowColor = "rgba(16, 185, 129, 0.15)";
    icon = "✅";
  } else if (type === "error") {
    borderColor = "rgba(239, 68, 68, 0.4)";
    glowColor = "rgba(239, 68, 68, 0.15)";
    icon = "❌";
  } else if (type === "info") {
    borderColor = "rgba(99, 102, 241, 0.4)";
    glowColor = "rgba(99, 102, 241, 0.15)";
    icon = "ℹ️";
  }
  
  notif.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${bg};
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #F8FAFC;
    padding: 14px 22px;
    border-radius: 12px;
    font-size: 14px;
    z-index: 10000;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 15px ${glowColor};
    border: 1px solid ${borderColor};
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    opacity: 0;
    transform: translateY(20px) scale(0.95);
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
  `;
  notif.innerHTML = `<span style="font-size: 16px;">${icon}</span> <span>${message}</span>`;
  document.body.appendChild(notif);
  
  setTimeout(() => {
    notif.style.opacity = "1";
    notif.style.transform = "translateY(0) scale(1)";
  }, 10);
  
  setTimeout(() => {
    notif.style.opacity = "0";
    notif.style.transform = "translateY(20px) scale(0.95)";
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", function (e) {
    if (e.target === this) this.classList.remove("open");
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const isDashboardPage =
    window.location.pathname.includes("dashboard.html") ||
    document.getElementById("page-dashboard");
  if (isDashboardPage) initDashboardPage();
});

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const btn = input.nextElementSibling;
  if (input.type === "password") {
    input.type = "text";
    if (btn) {
      btn.innerHTML = `
        <svg class="eye-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"></path>
        </svg>
      `;
    }
  } else {
    input.type = "password";
    if (btn) {
      btn.innerHTML = `
        <svg class="eye-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width: 18px; height: 18px;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
        </svg>
      `;
    }
  }
}

function openForgotPasswordModal(event) {
  if (event) event.preventDefault();
  closeLoginModal();
  const modal = document.getElementById("forgot-password-modal");
  if (modal) modal.classList.add("open");
  const resultDiv = document.getElementById("forgot-password-result");
  if (resultDiv) {
    resultDiv.style.display = "none";
    resultDiv.textContent = "";
  }
}

function closeForgotPasswordModal() {
  const modal = document.getElementById("forgot-password-modal");
  if (modal) modal.classList.remove("open");
}

// Lắng nghe submit của form quên mật khẩu
document.addEventListener("DOMContentLoaded", () => {
  const forgotForm = document.getElementById("forgot-password-form");
  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("forgot-email")?.value.trim();
      const resultDiv = document.getElementById("forgot-password-result");
      const submitBtn = document.getElementById("forgot-submit-button");
      
      if (!email) {
        alert("Vui lòng nhập email");
        return;
      }
      
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Đang gửi...";
      }
      
      try {
        const res = await apiRequest("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        
        const message = res?.message || "Đặt lại mật khẩu thành công!";
        if (resultDiv) {
          resultDiv.style.display = "block";
          resultDiv.style.background = "rgba(16, 185, 129, 0.1)";
          resultDiv.style.borderColor = "rgba(16, 185, 129, 0.3)";
          resultDiv.style.color = "var(--green)";
          resultDiv.innerHTML = `<strong>Thành công!</strong><br>${message}`;
        }
      } catch (error) {
        if (resultDiv) {
          resultDiv.style.display = "block";
          resultDiv.style.background = "rgba(239, 68, 68, 0.1)";
          resultDiv.style.borderColor = "rgba(239, 68, 68, 0.3)";
          resultDiv.style.color = "var(--red)";
          resultDiv.innerHTML = `<strong>Lỗi:</strong><br>${error.message || "Có lỗi xảy ra khi khôi phục mật khẩu"}`;
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Khôi phục mật khẩu";
        }
      }
    });
  }
});
