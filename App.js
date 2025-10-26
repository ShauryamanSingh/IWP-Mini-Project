// Student Attendance & Marks Management System (Frontend-only)
// Storage: localStorage (namespace: SAMMS_DB_V1)
// Charts: Chart.js via CDN
(function () {
  const STORAGE_KEY = "SAMMS_DB_V1";
  const APP_VERSION = 1;

  // App State
  const state = {
    currentUser: null, // { id, username, role, studentId? }
    charts: {},
    db: null,
  };

  // Initial Seed Data
  const defaultDB = () => ({
    version: APP_VERSION,
    users: [
      { id: uid(), username: "teacher1", password: "pass", role: "teacher" },
      // Students bound to student records (see below)
      { id: uid(), username: "s1", password: "pass", role: "student", studentId: "stu_1" },
      { id: uid(), username: "s2", password: "pass", role: "student", studentId: "stu_2" },
      { id: uid(), username: "s3", password: "pass", role: "student", studentId: "stu_3" },
    ],
    students: [
      { id: "stu_1", name: "Alice Johnson", className: "10A" },
      { id: "stu_2", name: "Bob Smith", className: "10A" },
      { id: "stu_3", name: "Carlos Lee", className: "10B" },
    ],
    subjects: ["Math", "Science", "English"],
    assessments: [
      // Example: { id, name, subject, className, date, total }
    ],
    marks: [
      // Example: { id, assessmentId, studentId, marks, total }
    ],
    attendance: [
      // Example: { id, date: "YYYY-MM-DD", className, studentId, present: true }
    ],
  });

  // Utils
  function uid() {
    return (
      "id_" +
      Math.random().toString(36).slice(2, 8) +
      "_" +
      Date.now().toString(36)
    );
  }
  function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db));
  }
  function loadDB() {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) {
      state.db = defaultDB();
      saveDB();
      return;
    }
    try {
      state.db = JSON.parse(s);
      // Simple migration path if needed later
      if (!state.db.version || state.db.version < APP_VERSION) {
        state.db.version = APP_VERSION;
        saveDB();
      }
    } catch (e) {
      console.error("Failed to parse DB. Resetting.", e);
      state.db = defaultDB();
      saveDB();
    }
  }
  function setCurrentUser(u) {
    state.currentUser = u;
    renderAuthControls();
  }
  function formatDate(d) {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toISOString().slice(0, 10);
  }

  // DOM helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Views
  function showView(viewId) {
    $$(".view").forEach((v) => v.classList.remove("active"));
    $(`#${viewId}`)?.classList.add("active");
  }

  function renderAuthControls() {
    const lbl = $("#currentUserLabel");
    const logoutBtn = $("#logoutBtn");
    const btnExport = $("#btnExport");
    const importLabel = $("#importLabel");

    if (state.currentUser) {
      lbl.textContent = `${state.currentUser.role.toUpperCase()}: ${state.currentUser.username}`;
      logoutBtn.classList.remove("hidden");
      btnExport.classList.remove("hidden");
      importLabel.classList.remove("hidden");
    } else {
      lbl.textContent = "";
      logoutBtn.classList.add("hidden");
      btnExport.classList.add("hidden");
      importLabel.classList.add("hidden");
    }
  }

  // Login / Logout
  function handleLogin(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const username = (fd.get("username") || "").trim();
    const password = (fd.get("password") || "").trim();
    const role = fd.get("role");

    const user = state.db.users.find(
      (u) => u.username === username && u.password === password && u.role === role
    );
    if (!user) {
      alert("Invalid credentials or role.");
      return;
    }
    setCurrentUser(user);

    if (user.role === "teacher") {
      showView("view-teacher");
      // default active tab: students
      selectTab("teacher-students");
      loadStudentsTable();
    } else {
      showView("view-student");
      renderStudentDashboard();
    }
  }

  function logout() {
    setCurrentUser(null);
    showView("view-login");
  }

  // Tabs
  function selectTab(tabId) {
    $$(".tab-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === tabId)
    );
    $$(".tab-panel").forEach((p) =>
      p.classList.toggle("active", p.id === tabId)
    );
    // Lazy loads
    if (tabId === "teacher-students") loadStudentsTable();
    if (tabId === "teacher-attendance") prepareAttendanceForm();
    if (tabId === "teacher-marks") resetMarksForms();
  }

  // Students Management
  function loadStudentsTable() {
    const tbody = $("#studentsTbody");
    tbody.innerHTML = "";
    const filter = ($("#studentClassFilter")?.value || "").trim();
    const list = state.db.students
      .filter((s) => (filter ? s.className === filter : true))
      .sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name));
    for (const s of list) {
      const username = state.db.users.find((u) => u.studentId === s.id)?.username || "-";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.name}</td>
        <td><span class="tag">${s.className}</span></td>
        <td>${username}</td>
        <td class="row" style="justify-content:flex-end;">
          <button class="secondary small" data-edit="${s.id}">Edit</button>
          <button class="danger small" data-del="${s.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Wire edit/delete
    $$("button[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => editStudent(btn.dataset.edit))
    );
    $$( "button[data-del]").forEach((btn) =>
      btn.addEventListener("click", () => deleteStudent(btn.dataset.del))
    );
  }

  function editStudent(studentId) {
    const s = state.db.students.find((x) => x.id === studentId);
    if (!s) return;
    const user = state.db.users.find((u) => u.studentId === s.id);

    const form = $("#studentForm");
    form.id.value = s.id;
    form.name.value = s.name;
    form.className.value = s.className;
    form.username.value = user?.username || "";
    form.password.value = user?.password || "pass";
    form.name.focus();
  }

  function deleteStudent(studentId) {
    if (!confirm("Delete this student? Related marks and attendance will remain, but login will be removed.")) return;
    // Remove user linked to this student
    state.db.users = state.db.users.filter((u) => u.studentId !== studentId);
    // Remove student record
    state.db.students = state.db.students.filter((s) => s.id !== studentId);
    saveDB();
    loadStudentsTable();
  }

  function handleStudentForm(e) {
    e.preventDefault();
    const f = e.target;
    const id = f.id.value.trim();
    const name = f.name.value.trim();
    const className = f.className.value.trim();
    const username = f.username.value.trim();
    const password = f.password.value.trim();

    if (!name || !className || !username || !password) {
      alert("Please fill out all fields.");
      return;
    }

    if (id) {
      // Update
      const s = state.db.students.find((x) => x.id === id);
      if (!s) return;
      s.name = name;
      s.className = className;

      let user = state.db.users.find((u) => u.studentId === id);
      if (!user) {
        state.db.users.push({ id: uid(), username, password, role: "student", studentId: id });
      } else {
        user.username = username;
        user.password = password;
      }
    } else {
      // Create
      if (state.db.users.some((u) => u.username === username)) {
        alert("Username already exists.");
        return;
      }
      const newId = uid();
      state.db.students.push({ id: newId, name, className });
      state.db.users.push({ id: uid(), username, password, role: "student", studentId: newId });
    }

    saveDB();
    f.reset();
    loadStudentsTable();
  }

  // Attendance
  function getStudentsByClass(className) {
    return state.db.students
      .filter((s) => s.className === className)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function prepareAttendanceForm() {
    const form = $("#attendanceForm");
    if (!form.date.value) {
      form.date.value = formatDate(new Date());
    }
    // If class not set, try to prefill with a common class
    if (!form.className.value) {
      const topClass = mostCommonClass();
      if (topClass) form.className.value = topClass;
    }
    renderAttendanceTable();
  }

  function renderAttendanceTable() {
    const form = $("#attendanceForm");
    const className = form.className.value.trim();
    const date = form.date.value;
    const tbody = $("#attendanceTbody");
    tbody.innerHTML = "";

    if (!className || !date) {
      tbody.innerHTML = `<tr><td colspan="2" class="muted">Select date and class</td></tr>`;
      return;
    }

    const students = getStudentsByClass(className);
    if (!students.length) {
      tbody.innerHTML = `<tr><td colspan="2" class="muted">No students in class ${className}</td></tr>`;
      return;
    }

    const existing = state.db.attendance.filter(
      (a) => a.className === className && a.date === date
    );
    const presentMap = new Map(existing.map((a) => [a.studentId, a.present]));

    for (const s of students) {
      const tr = document.createElement("tr");
      const checked = presentMap.has(s.id) ? presentMap.get(s.id) : false;
      tr.innerHTML = `
        <td>${s.name}</td>
        <td>
          <input type="checkbox" data-student="${s.id}" ${checked ? "checked" : ""} />
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  function handleAttendanceSave(e) {
    e.preventDefault();
    const form = e.target;
    const className = form.className.value.trim();
    const date = form.date.value;
    if (!className || !date) {
      alert("Select a date and class.");
      return;
    }
    const inputs = $$('input[type="checkbox"][data-student]', form);
    // Remove old records for this date+class
    state.db.attendance = state.db.attendance.filter(
      (a) => !(a.className === className && a.date === date)
    );
    for (const inp of inputs) {
      const studentId = inp.dataset.student;
      const present = inp.checked;
      state.db.attendance.push({
        id: uid(),
        date,
        className,
        studentId,
        present,
      });
    }
    saveDB();
    alert("Attendance saved.");
  }

  function handleAttendanceLoad() {
    renderAttendanceTable();
  }

  function markAllAttendance(value) {
    $$('input[type="checkbox"][data-student]', $("#attendanceForm")).forEach(
      (c) => (c.checked = value)
    );
  }

  // Marks
  let marksSheetState = null;
  function resetMarksForms() {
    $("#marksForm").classList.add("hidden");
    $("#marksMetaForm").reset();
    const topClass = mostCommonClass();
    if (topClass) $("#marksMetaForm").className.value = topClass;
    // Pre-fill subject if any
    if (state.db.subjects?.length) {
      $("#marksMetaForm").subject.value = state.db.subjects[0];
    }
    $("#marksMetaForm").date.value = formatDate(new Date());
  }

  function handlePrepareMarksSheet() {
    const f = $("#marksMetaForm");
    const className = f.className.value.trim();
    const subject = f.subject.value.trim();
    const assessmentName = f.assessmentName.value.trim();
    const date = f.date.value;
    const total = parseInt(f.total.value, 10);

    if (!className || !subject || !assessmentName || !date || !total) {
      alert("Please complete the metadata fields.");
      return;
    }
    const students = getStudentsByClass(className);
    if (!students.length) {
      alert(`No students found in class ${className}.`);
      return;
    }

    marksSheetState = { className, subject, assessmentName, date, total, students };
    $("#marksSheetTitle").textContent = `${assessmentName} - ${subject} (${className})`;
    const tbody = $("#marksTbody");
    tbody.innerHTML = "";
    for (const s of students) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${s.name}</td>
        <td>
          <input type="number" min="0" max="${total}" step="0.5" data-student="${s.id}" placeholder="0 - ${total}" />
        </td>
      `;
      tbody.appendChild(tr);
    }
    $("#marksForm").classList.remove("hidden");
  }

  function handleSaveMarks(e) {
    e.preventDefault();
    if (!marksSheetState) return;

    // Create assessment
    const assessmentId = uid();
    state.db.assessments.push({
      id: assessmentId,
      name: marksSheetState.assessmentName,
      subject: marksSheetState.subject,
      className: marksSheetState.className,
      date: marksSheetState.date,
      total: marksSheetState.total,
    });

    // Gather marks
    const inputs = $$('input[type="number"][data-student]', $("#marksForm"));
    for (const inp of inputs) {
      const v = inp.value;
      const num = v === "" ? null : Number(v);
      state.db.marks.push({
        id: uid(),
        assessmentId,
        studentId: inp.dataset.student,
        marks: num ?? 0,
        total: marksSheetState.total,
      });
    }
    saveDB();
    alert("Marks saved.");
    $("#marksForm").classList.add("hidden");
    marksSheetState = null;
  }

  // Reports (Teacher)
  function handleBuildReports() {
    // Attendance % by student (class, date range)
    const rf = $("#reportFilters");
    const className = (rf.className.value || "").trim();
    const subject = (rf.subject.value || "").trim();
    const fromDate = rf.fromDate.value ? formatDate(rf.fromDate.value) : null;
    const toDate = rf.toDate.value ? formatDate(rf.toDate.value) : null;

    buildAttendanceByStudentChart(className, fromDate, toDate);
    buildAvgMarksByStudentChart(className, subject);
    buildClassAssessmentAvgChart(className, subject);
    buildTopPerformersChart(className, subject);
  }

  function buildAttendanceByStudentChart(className, fromDate, toDate) {
    const ctx = $("#attendanceByStudentChart");
    const students = (className ? getStudentsByClass(className) : state.db.students.slice())
      .sort((a, b) => a.name.localeCompare(b.name));
    const totalDaysByStudent = new Map();
    const presentDaysByStudent = new Map();

    // Consider only attendance in date range (and class if provided)
    const records = state.db.attendance.filter((a) => {
      if (className && a.className !== className) return false;
      if (fromDate && a.date < fromDate) return false;
      if (toDate && a.date > toDate) return false;
      return true;
    });

    // Count total points per student by unique dates in filtered set
    // Simplify: assume each date+student has a record already when saved
    for (const a of records) {
      totalDaysByStudent.set(a.studentId, 1 + (totalDaysByStudent.get(a.studentId) || 0));
      if (a.present) {
        presentDaysByStudent.set(a.studentId, 1 + (presentDaysByStudent.get(a.studentId) || 0));
      }
    }

    const labels = students.map((s) => s.name);
    const data = students.map((s) => {
      const total = totalDaysByStudent.get(s.id) || 0;
      const present = presentDaysByStudent.get(s.id) || 0;
      return total ? Math.round((present / total) * 100) : 0;
    });

    renderBarChart(ctx, "Attendance %", labels, data, "#60a5fa");
  }

  function buildAvgMarksByStudentChart(className, subject) {
    const ctx = $("#avgMarksByStudentChart");
    const students = (className ? getStudentsByClass(className) : state.db.students.slice())
      .sort((a, b) => a.name.localeCompare(b.name));

    // Collect assessments by subject (if provided) and class
    const assessments = state.db.assessments.filter((a) => {
      if (className && a.className !== className) return false;
      if (subject && a.subject !== subject) return false;
      return true;
    });
    const assessIds = new Set(assessments.map((a) => a.id));

    const sums = new Map();
    const counts = new Map();

    for (const m of state.db.marks) {
      if (!assessIds.has(m.assessmentId)) continue;
      sums.set(m.studentId, (sums.get(m.studentId) || 0) + (m.marks || 0));
      counts.set(m.studentId, (counts.get(m.studentId) || 0) + 1);
    }

    const labels = students.map((s) => s.name);
    const data = students.map((s) => {
      const total = sums.get(s.id) || 0;
      const c = counts.get(s.id) || 0;
      return c ? +(total / c).toFixed(2) : 0;
    });

    renderBarChart(ctx, "Average Marks", labels, data, "#34d399");
  }

  function buildClassAssessmentAvgChart(className, subject) {
    const ctx = $("#classAssessmentAvgChart");
    const assessments = state.db.assessments
      .filter((a) => {
        if (className && a.className !== className) return false;
        if (subject && a.subject !== subject) return false;
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

    const labels = assessments.map((a) => `${a.name} (${a.subject})`);
    const data = assessments.map((a) => {
      const ms = state.db.marks.filter((m) => m.assessmentId === a.id);
      if (!ms.length) return 0;
      const avg = ms.reduce((acc, m) => acc + (m.marks || 0), 0) / ms.length;
      return +avg.toFixed(2);
    });

    renderLineChart(ctx, "Class Average", labels, data, "#eab308");
  }

  function buildTopPerformersChart(className, subject) {
    const ctx = $("#topPerformersChart");
    // Latest assessment matching filters
    const assessments = state.db.assessments
      .filter((a) => {
        if (className && a.className !== className) return false;
        if (subject && a.subject !== subject) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // latest first

    if (!assessments.length) {
      renderBarChart(ctx, "Top Performers", [], [], "#f472b6");
      return;
    }
    const latest = assessments[0];
    const ms = state.db.marks.filter((m) => m.assessmentId === latest.id);
    // Map studentId -> marks
    const byStudent = ms.map((m) => ({
      studentId: m.studentId,
      marks: m.marks || 0,
    }));
    // sort desc and take top 5
    byStudent.sort((a, b) => b.marks - a.marks);
    const top = byStudent.slice(0, 5);
    const labels = top.map((x) => getStudentName(x.studentId));
    const data = top.map((x) => x.marks);

    renderBarChart(ctx, `Top Performers - ${latest.name}`, labels, data, "#f472b6");
  }

  // Student Dashboard
  function renderStudentDashboard() {
    const u = state.currentUser;
    if (!u?.studentId) {
      $("#studentInfo").textContent = "No student bound to this account.";
      return;
    }
    const s = state.db.students.find((x) => x.id === u.studentId);
    if (!s) {
      $("#studentInfo").textContent = "Student record not found.";
      return;
    }
    $("#studentInfo").innerHTML = `${s.name} <span class="badge">${s.className}</span>`;

    buildStudentAttendanceOverTime(s.id);
    buildStudentAvgMarksBySubject(s.id);
    buildStudentLatestScores(s.id);
    buildStudentSummary(s.id);
  }

  function buildStudentAttendanceOverTime(studentId) {
    const ctx = $("#studentAttendanceOverTime");
    // For that student, group by date, use 1 for present 0 for absent, sorted by date
    const rs = state.db.attendance
      .filter((a) => a.studentId === studentId)
      .sort((a, b) => a.date.localeCompare(b.date));

    const labels = rs.map((r) => r.date);
    const data = rs.map((r) => (r.present ? 1 : 0));
    renderLineChart(ctx, "Present(1)/Absent(0)", labels, data, "#60a5fa");
  }

  function buildStudentAvgMarksBySubject(studentId) {
    const ctx = $("#studentAvgMarksBySubject");
    // For this student, group by subject -> avg(marks)
    const subjectSums = new Map();
    const subjectCounts = new Map();
    for (const m of state.db.marks.filter((x) => x.studentId === studentId)) {
      const a = state.db.assessments.find((as) => as.id === m.assessmentId);
      if (!a) continue;
      const subj = a.subject;
      subjectSums.set(subj, (subjectSums.get(subj) || 0) + (m.marks || 0));
      subjectCounts.set(subj, (subjectCounts.get(subj) || 0) + 1);
    }
    const labels = Array.from(subjectSums.keys()).sort();
    const data = labels.map((subj) => {
      const sum = subjectSums.get(subj) || 0;
      const count = subjectCounts.get(subj) || 0;
      return count ? +(sum / count).toFixed(2) : 0;
    });
    renderBarChart(ctx, "Avg Marks", labels, data, "#34d399");
  }

  function buildStudentLatestScores(studentId) {
    const ctx = $("#studentLatestScores");
    // Take last 5 assessments (by date) where this student has marks
    const marksByAssessment = new Map(); // assessmentId -> marks
    for (const m of state.db.marks.filter((x) => x.studentId === studentId)) {
      marksByAssessment.set(m.assessmentId, m.marks || 0);
    }
    const assessments = state.db.assessments
      .filter((a) => marksByAssessment.has(a.id))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
      .reverse(); // chronological display

    const labels = assessments.map((a) => `${a.name} (${a.subject})`);
    const data = assessments.map((a) => marksByAssessment.get(a.id));

    renderLineChart(ctx, "Recent Scores", labels, data, "#eab308");
  }

  function buildStudentSummary(studentId) {
    const ul = $("#studentSummary");
    ul.innerHTML = "";
    const att = state.db.attendance.filter((a) => a.studentId === studentId);
    const present = att.filter((a) => a.present).length;
    const total = att.length;
    const attendancePct = total ? Math.round((present / total) * 100) : 0;

    // Overall average marks
    const myMarks = state.db.marks.filter((m) => m.studentId === studentId);
    const avg = myMarks.length
      ? +(myMarks.reduce((acc, m) => acc + (m.marks || 0), 0) / myMarks.length).toFixed(2)
      : 0;

    const li1 = document.createElement("li");
    li1.textContent = `Attendance: ${present}/${total} (${attendancePct}%)`;
    const li2 = document.createElement("li");
    li2.textContent = `Overall Average Marks: ${avg}`;
    ul.appendChild(li1);
    ul.appendChild(li2);
  }

  // Chart utilities
  function renderBarChart(canvas, label, labels, data, color) {
    // destroy previous
    destroyChart(canvas);
    state.charts[canvas.id] = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            backgroundColor: color,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, labels: { color: "#e5e7eb" } },
        },
        scales: {
          x: { ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
          y: { ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
        },
      },
    });
  }

  function renderLineChart(canvas, label, labels, data, color) {
    destroyChart(canvas);
    state.charts[canvas.id] = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label,
            data,
            borderColor: color,
            backgroundColor: color + "44",
            fill: true,
            tension: 0.25,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, labels: { color: "#e5e7eb" } },
        },
        scales: {
          x: { ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
          y: { ticks: { color: "#9ca3af" }, grid: { color: "#1f2937" } },
        },
      },
    });
  }

  function destroyChart(canvas) {
    const existing = state.charts[canvas.id];
    if (existing) {
      existing.destroy();
      delete state.charts[canvas.id];
    }
  }

  function mostCommonClass() {
    const counts = new Map();
    for (const s of state.db.students) {
      counts.set(s.className, 1 + (counts.get(s.className) || 0));
    }
    let best = null, max = 0;
    for (const [cls, cnt] of counts) {
      if (cnt > max) { best = cls; max = cnt; }
    }
    return best;
  }

  function getStudentName(studentId) {
    return state.db.students.find((s) => s.id === studentId)?.name || "Unknown";
  }

  // Export / Import
  function handleExport() {
    const blob = new Blob([JSON.stringify(state.db, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `samms_export_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== "object" || !data.users || !data.students) {
        alert("Invalid file format.");
        return;
      }
      state.db = data;
      saveDB();
      alert("Import successful.");
      // Refresh views depending on role
      if (state.currentUser?.role === "teacher") {
        selectTab("teacher-students");
        loadStudentsTable();
      } else if (state.currentUser?.role === "student") {
        renderStudentDashboard();
      }
    } catch (err) {
      console.error(err);
      alert("Import failed.");
    } finally {
      e.target.value = "";
    }
  }

  // Wire events
  function wireEvents() {
    $("#loginForm").addEventListener("submit", handleLogin);
    $("#logoutBtn").addEventListener("click", logout);

    // Tabs
    $$(".tab-btn").forEach((b) =>
      b.addEventListener("click", () => selectTab(b.dataset.tab))
    );

    // Students
    $("#studentForm").addEventListener("submit", handleStudentForm);
    $("#resetStudentForm").addEventListener("click", () => $("#studentForm").reset());
    $("#refreshStudents").addEventListener("click", loadStudentsTable);
    $("#studentClassFilter").addEventListener("input", loadStudentsTable);

    // Attendance
    $("#attendanceForm").addEventListener("submit", handleAttendanceSave);
    $("#attendanceForm").date.addEventListener("change", renderAttendanceTable);
    $("#attendanceForm").className.addEventListener("change", renderAttendanceTable);
    $("#loadAttendance").addEventListener("click", handleAttendanceLoad);
    $("#markAllPresent").addEventListener("click", () => markAllAttendance(true));
    $("#markAllAbsent").addEventListener("click", () => markAllAttendance(false));

    // Marks
    $("#prepareMarks").addEventListener("click", handlePrepareMarksSheet);
    $("#marksForm").addEventListener("submit", handleSaveMarks);
    $("#cancelMarks").addEventListener("click", () => {
      $("#marksForm").classList.add("hidden");
      marksSheetState = null;
    });

    // Reports
    $("#buildReports").addEventListener("click", handleBuildReports);

    // Export / Import
    $("#btnExport").addEventListener("click", handleExport);
    $("#importFile").addEventListener("change", handleImport);
  }

  // Init
  function init() {
    loadDB();
    renderAuthControls();
    showView("view-login");
    wireEvents();
  }

  document.addEventListener("DOMContentLoaded", init);
})();