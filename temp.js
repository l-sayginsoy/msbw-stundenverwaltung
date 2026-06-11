      const STATE = {
        view: "loadingView",
        einstellungen: null,
        ulList: [],
        entries: [],
        freigaben: {},
        abschluesse: {},
        currentUser: null,
        isAdmin: false,
        adminMonthStr: new Date().toISOString().substring(0, 7), // "YYYY-MM"
        adminTab: "abrechnung",
        adminYearStart:
          new Date().getMonth() >= 2
            ? new Date().getFullYear()
            : new Date().getFullYear() - 1,
        ulActiveMonthStr: null,
      };

      // ---- Helper functions ----
      const el = (id) => document.getElementById(id);

      const showNotification = (msg, duration = 3000) => {
        const overlay = el("notificationOverlay");
        el("notificationMsg").textContent = msg;
        overlay.classList.remove("opacity-0", "pointer-events-none");
        setTimeout(
          () => overlay.classList.add("opacity-0", "pointer-events-none"),
          duration,
        );
      };

      const calculateHours = (von, bis) => {
        if (!von || !bis) return 0;
        const [vH, vM] = von.split(":").map(Number);
        const [bH, bM] = bis.split(":").map(Number);
        let hours = bH - vH + (bM - vM) / 60;
        return Math.max(0, parseFloat(hours.toFixed(2))); // Prevent negative
      };

      const formatHours = (h) =>
        h.toLocaleString("de-DE", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 2,
        });
      const formatMonthStr = (yyyyMm) => {
        const [y, m] = yyyyMm.split("-");
        const date = new Date(y, parseInt(m) - 1, 1);
        return date.toLocaleDateString("de-DE", {
          month: "long",
          year: "numeric",
        });
      };

      // ---- Navigation & UI Core ----
      const setAppWidth = (isAdmin) => {
        const app = el("app");
        if (isAdmin) {
          app.classList.remove("max-w-xl");
          app.classList.add("max-w-6xl");
        } else {
          app.classList.remove("max-w-6xl");
          app.classList.add("max-w-xl");
        }
      };

      const switchView = (viewId) => {
        const views = [
          "loadingView",
          "setupView",
          "roleSelectView",
          "ulLoginView",
          "ulDashboardView",
          "adminLoginView",
          "adminDashboardView",
        ];
        views.forEach((v) => {
          const element = el(v);
          if (!element) return;
          if (v === viewId) {
            element.classList.remove("hidden");
            element.classList.add("flex");
          } else {
            element.classList.add("hidden");
            element.classList.remove("flex");
          }
        });
        STATE.view = viewId;

        // Update Header Logout visibility
        if (STATE.currentUser || STATE.isAdmin)
          el("logoutBtn").classList.remove("hidden");
        else el("logoutBtn").classList.add("hidden");

        // Set layout width
        setAppWidth(STATE.isAdmin && viewId === "adminDashboardView");

        // Initialize lucide icons again for dynamically un-hidden elements
        if (window.lucide) window.lucide.createIcons();
      };

      const logout = () => {
        STATE.currentUser = null;
        STATE.isAdmin = false;
        switchView("roleSelectView");
      };

      // ---- Initialization ----
      const initApp = async () => {
        STATE.einstellungen = await API.getEinstellungen();

        if (!STATE.einstellungen) {
          // First run ever
          switchView("setupView");
        } else {
          // System is setup
          loadDataAndStart();
        }
      };

      const loadDataAndStart = async () => {
        STATE.ulList = await API.getUebungsleiterList();
        STATE.entries = await API.getEintraege();
        STATE.freigaben = await API.getFreigaben();
        STATE.abschluesse = await API.getAbschluesse();

        if (STATE.currentUser) {
          renderUlDashboard();
        } else if (STATE.isAdmin) {
          renderAdminDashboard();
        } else {
          switchView("roleSelectView");
        }
      };

      // ---- Setup Logic ----
      el("setupSubmitBtn").addEventListener("click", async () => {
        const pin = el("setupAdminPin").value;
        const seed = el("setupSeedData").checked;
        const err = el("setupError");
        err.classList.add("hidden");

        if (pin.length !== 4 || isNaN(pin)) {
          err.textContent = "Der PIN muss aus exakt 4 Ziffern bestehen.";
          err.classList.remove("hidden");
          return;
        }

        // Save settings
        await API.setEinstellungen({
          admin_pin: pin,
          pflicht_stunden: 10,
          kulanz_schwelle: 8,
        });

        // Seed Data
        if (seed) {
          await API.addUebungsleiter({
            name: "Max Mustermann",
            einrichtung: "Krankenhaus Villingen",
            pin: "1234",
            adresse: "Musterstraße 1, 78050 Villingen",
            notizen: "Sehr zuverlässig",
          });
          await API.addUebungsleiter({
            name: "Aisha Yilmaz",
            einrichtung: "Klinikum Singen",
            pin: "0000",
            adresse: "Hauptstraße 5, 78224 Singen",
            notizen: "",
          });
          await API.addUebungsleiter({
            name: "Fatima Ali",
            einrichtung: "Marienhospital Stuttgart",
            pin: "4321",
            adresse: "",
            notizen: "Fällt manchmal aus.",
          });
        }

        showNotification("Setup erfolgreich!");
        initApp(); // re-init
      });

      // ---- Role Selection Routing ----
      el("navUlLoginBtn").addEventListener("click", () => {
        el("ulLoginName").value = "";
        el("ulLoginPin").value = "";
        el("ulLoginError").classList.add("hidden");
        switchView("ulLoginView");
      });
      el("navAdminLoginBtn").addEventListener("click", () => {
        el("adminLoginPin").value = "";
        el("adminLoginError").classList.add("hidden");
        switchView("adminLoginView");
      });
      el("backToRoleFromUlBtn").addEventListener("click", () =>
        switchView("roleSelectView"),
      );
      el("backToRoleFromAdminBtn").addEventListener("click", () =>
        switchView("roleSelectView"),
      );
      el("logoutBtn").addEventListener("click", logout);

      // ---- Übungsleiter Core ----
      el("ulSubmitMonthBtn").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const monat = STATE.ulActiveMonthStr;
        if (!monat) return;

        if (btn.dataset.armed !== "true") {
          const origText = btn.innerHTML;
          btn.dataset.origText = origText;
          btn.dataset.armed = "true";
          btn.innerHTML = `<i data-lucide="alert-triangle" class="w-5 h-5 text-orange-200"></i> <span class="text-orange-50 justify-center flex-1 pr-6">Sicher? Bitte erneut klicken!</span>`;
          btn.classList.add("bg-orange-600", "hover:bg-orange-700");
          btn.classList.remove("bg-gray-900", "hover:bg-black");

          // Automatically disarm after 5 seconds if not clicked
          setTimeout(() => {
            if (btn.dataset.armed === "true") {
              btn.dataset.armed = "false";
              btn.innerHTML = btn.dataset.origText;
              btn.classList.remove("bg-orange-600", "hover:bg-orange-700");
              btn.classList.add("bg-gray-900", "hover:bg-black");
              if (window.lucide) window.lucide.createIcons();
            }
          }, 5000);

          if (window.lucide) window.lucide.createIcons();
          return;
        }

        // It is armed, proceed with submission
        btn.dataset.armed = "false";
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> <span class="flex-1 pr-6">Speichere...</span>`;
        btn.classList.remove("bg-orange-600", "hover:bg-orange-700");
        btn.classList.add("bg-gray-900", "hover:bg-black");

        await API.setAbschluss(monat, STATE.currentUser.id, true);
        STATE.abschluesse = await API.getAbschluesse();

        showNotification(
          "Monat " +
            formatMonthStr(monat) +
            " wurde erfolgreich abgeschlossen!",
        );
        renderUlDashboard();

        btn.disabled = false;
        btn.innerHTML =
          btn.dataset.origText ||
          `<i data-lucide="lock" class="w-5 h-5"></i> Monat abschließen`;
        if (window.lucide) window.lucide.createIcons();
      });

      el("ulLoginSubmitBtn").addEventListener("click", () => {
        const nameVal = el("ulLoginName").value.trim().toLowerCase();
        const pinVal = el("ulLoginPin").value;
        const err = el("ulLoginError");

        if (!nameVal || !pinVal) {
          err.textContent = "Bitte Namen und PIN eingeben.";
          err.classList.remove("hidden");
          return;
        }

        const matchedUser = STATE.ulList.find(
          (u) => u.name.toLowerCase() === nameVal,
        );
        if (matchedUser && matchedUser.pin === pinVal) {
          STATE.currentUser = matchedUser;
          renderUlDashboard();
        } else {
          err.textContent = "Falscher Name oder PIN. Bitte erneut versuchen.";
          err.classList.remove("hidden");
        }
      });

      const renderUlDashboard = () => {
        switchView("ulDashboardView");
        const user = STATE.currentUser;

        el("ulDashName").textContent = user.name;
        el("ulDashEinrichtung").textContent = user.einrichtung;

        const todayStr = new Date().toISOString().substring(0, 7);
        let activeMonth = todayStr;

        const userMonths = [
          ...new Set(
            STATE.entries
              .filter((e) => e.uebungsleiter_id === user.id)
              .map((e) => e.monat),
          ),
        ].sort();
        const closedMonths = Object.keys(STATE.abschluesse)
          .filter((m) => STATE.abschluesse[m] && STATE.abschluesse[m][user.id])
          .sort();

        if (userMonths.length > 0) {
          activeMonth = userMonths[0]; // Start at earliest
          for (const m of userMonths) {
            if (STATE.abschluesse[m] && STATE.abschluesse[m][user.id]) {
              let [y, mo] = m.split("-").map(Number);
              if (++mo === 13) {
                mo = 1;
                y++;
              }
              activeMonth = `${y}-${mo.toString().padStart(2, "0")}`;
            } else {
              activeMonth = m;
              break;
            }
          }
        } else if (closedMonths.length > 0) {
          let m = closedMonths[closedMonths.length - 1];
          let [y, mo] = m.split("-").map(Number);
          if (++mo === 13) {
            mo = 1;
            y++;
          }
          activeMonth = `${y}-${mo.toString().padStart(2, "0")}`;
        }

        STATE.ulActiveMonthStr = activeMonth;

        el("newEntryDatum").value =
          activeMonth === todayStr
            ? new Date().toISOString().substring(0, 10)
            : activeMonth + "-01";

        // Lock Datepicker to active month
        el("newEntryDatum").min = activeMonth + "-01";
        el("newEntryDatum").max = activeMonth + "-31";

        el("ulDashBigMonth").textContent = formatMonthStr(activeMonth);
        el("ulDashListMonthLabel").textContent = formatMonthStr(activeMonth);
        el("ulDashMonthStatus").textContent = formatMonthStr(activeMonth);

        updateUlProgressAndList(activeMonth);
      };

      const updateUlProgressAndList = (monthStr) => {
        // Filter entries for this user & month
        const userEntries = STATE.entries
          .filter(
            (e) =>
              e.uebungsleiter_id === STATE.currentUser.id &&
              e.monat === monthStr,
          )
          .sort((a, b) => new Date(b.datum) - new Date(a.datum));

        const totalHours = userEntries.reduce((sum, e) => sum + e.stunden, 0);
        const goal = STATE.einstellungen.pflicht_stunden;

        // Update Progress Bar UI
        el("ulDashHoursCount").innerHTML =
          `${formatHours(totalHours)} <span class="text-3xl text-gray-400 font-medium ml-1">/ ${goal}h</span>`;
        const pct = Math.min(100, Math.round((totalHours / goal) * 100));
        const bar = el("ulDashProgressBar");
        bar.style.width = `${pct}%`;

        if (pct >= 100) {
          bar.classList.replace("bg-primary", "bg-green-500");
          el("ulDashGoalMsg").innerHTML =
            `<span class="text-green-600 font-bold flex items-center gap-1"><i data-lucide="check-circle" class="w-5 h-5"></i> Ziel erreicht!</span>`;
        } else {
          bar.classList.replace("bg-green-500", "bg-primary");
          el("ulDashGoalMsg").innerHTML =
            `Noch <span class="font-bold text-gray-600">${formatHours(goal - totalHours)}</span> Stunden bis zum Pflichtziel`;
        }

        // Render List
        const listDiv = el("ulEntriesList");
        if (userEntries.length === 0) {
          listDiv.innerHTML =
            '<div class="text-center text-lg text-secondary p-4 bg-bglight rounded-xl border border-gray-100">Keine Einträge in diesem Monat.</div>';
        } else {
          listDiv.innerHTML = userEntries
            .map(
              (e) => `
                <div class="flex justify-between items-center p-4 bg-bglight rounded-xl border-l-8 border-primary shadow-sm">
                  <div>
                    <p class="font-bold text-gray-800 text-xl">${new Date(e.datum).toLocaleDateString("de-DE")}</p>
                    <p class="text-lg text-secondary mt-1 font-bold">${e.von} - ${e.bis} Uhr</p>
                  </div>
                  <span class="font-mono font-bold text-primary text-4xl">${formatHours(e.stunden)}h</span>
                </div>
             `,
            )
            .join("");
        }
        if (window.lucide) window.lucide.createIcons();
      };

      // Add Entry Events
      const previewHours = () => {
        const hours = calculateHours(
          el("newEntryVon").value,
          el("newEntryBis").value,
        );
        el("newEntryPreview").textContent = formatHours(hours) + "h";
        el("addEntryBtn").disabled = hours <= 0;
      };
      el("newEntryVon").addEventListener("input", previewHours);
      el("newEntryBis").addEventListener("input", previewHours);

      el("addEntryBtn").addEventListener("click", async () => {
        const datum = el("newEntryDatum").value;
        const von = el("newEntryVon").value;
        const bis = el("newEntryBis").value;
        const stunden = calculateHours(von, bis);

        if (!datum || !von || !bis || stunden <= 0) return;

        const btn = el("addEntryBtn");
        btn.disabled = true;
        btn.innerHTML =
          '<div class="loader" style="width:16px;height:16px;border-width:2px;border-top-width:2px;border-top-color:white;"></div> Speichern...';

        await API.addEintrag({
          uebungsleiter_id: STATE.currentUser.id,
          datum: datum,
          monat: datum.substring(0, 7),
          von: von,
          bis: bis,
          stunden: stunden,
        });

        showNotification("Eintrag gespeichert!");

        el("newEntryVon").value = "";
        el("newEntryBis").value = "";
        previewHours();
        btn.innerHTML = "Eintrag speichern";

        STATE.entries = await API.getEintraege();
        updateUlProgressAndList(datum.substring(0, 7)); // update list with the month of the added entry
      });

      // ---- Admin Core ----
      el("adminLoginSubmitBtn").addEventListener("click", () => {
        const pin = el("adminLoginPin").value;
        const err = el("adminLoginError");

        if (pin === STATE.einstellungen.admin_pin) {
          STATE.isAdmin = true;
          renderAdminDashboard();
        } else {
          err.textContent = "Falscher Admin-PIN.";
          err.classList.remove("hidden");
        }
      });

      window.switchAdminTab = (tab) => {
        STATE.adminTab = tab;
        document.querySelectorAll(".admin-tab-btn").forEach((b) => {
          b.classList.remove("text-primary", "border-primary", "font-bold");
          b.classList.add("text-gray-500", "border-transparent", "font-medium");
        });
        const activeBtn = el(`tabBtn-${tab}`);
        activeBtn.classList.remove(
          "text-gray-500",
          "border-transparent",
          "font-medium",
        );
        activeBtn.classList.add("text-primary", "border-primary", "font-bold");

        el("adminTab-abrechnung").classList.add("hidden");
        el("adminTab-jahr").classList.add("hidden");
        el("adminTab-verwaltung").classList.add("hidden");

        el(`adminTab-${tab}`).classList.remove("hidden");
        el(`adminTab-${tab}`).classList.add("flex");
        renderAdminDashboard();
      };

      const renderAdminDashboard = () => {
        switchView("adminDashboardView");
        if (STATE.adminTab === "abrechnung") renderAdminAbrechnung();
        else if (STATE.adminTab === "jahr") renderAdminJahr();
        else if (STATE.adminTab === "verwaltung") renderAdminVerwaltung();
        if (window.lucide) window.lucide.createIcons();
      };

      const renderAdminAbrechnung = () => {
        el("adminSelectedMonthLabel").textContent = formatMonthStr(
          STATE.adminMonthStr,
        );

        const monthEntries = STATE.entries.filter(
          (e) => e.monat === STATE.adminMonthStr,
        );
        const goal = STATE.einstellungen.pflicht_stunden;
        const listDiv = el("adminUsersList");

        if (STATE.ulList.length === 0) {
          listDiv.innerHTML =
            '<p class="text-center text-sm text-secondary bg-white p-4">Keine Übungsleiter angelegt.</p>';
          return;
        }

        const html = STATE.ulList
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((ul) => {
            const hrs = monthEntries
              .filter((e) => e.uebungsleiter_id === ul.id)
              .reduce((sum, e) => sum + e.stunden, 0);
            let isFreigegeben =
              hrs >= goal ||
              (STATE.freigaben[STATE.adminMonthStr] &&
                STATE.freigaben[STATE.adminMonthStr][ul.id]);
            let isAbgeschlossen =
              STATE.abschluesse[STATE.adminMonthStr] &&
              STATE.abschluesse[STATE.adminMonthStr][ul.id];

            let statusUI = "";
            let bgLine = "";
            if (hrs >= goal) {
              statusUI = `<div class="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 w-max"><i data-lucide="check" class="w-3 h-3"></i> Ziel erreicht</div>`;
              bgLine = "border-l-4 border-emerald-400";
            } else if (isFreigegeben) {
              statusUI = `<div class="text-primary bg-primary/10 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 w-max"><i data-lucide="hand-heart" class="w-3 h-3"></i> Zugeständnis (Fehlt: ${formatHours(goal - hrs)}h)</div>`;
              bgLine = "border-l-4 border-primary";
            } else {
              statusUI = `<div class="text-red-500 bg-red-50 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1 w-max"><i data-lucide="triangle-alert" class="w-3 h-3"></i> Nicht erreicht (Fehlt: ${formatHours(goal - hrs)}h)</div>`;
              bgLine = "border-l-4 border-red-400 opacity-70";
            }

            const uEntries = monthEntries
              .filter((e) => e.uebungsleiter_id === ul.id)
              .sort((a, b) => a.datum.localeCompare(b.datum));
            const entriesHtml =
              uEntries.length === 0
                ? `<div class="text-center text-xs text-gray-400 py-3">Keine Einträge für diesen Monat</div>`
                : uEntries
                    .map(
                      (e) => `
                    <div class="flex justify-between items-center py-2">
                       <span class="text-xs text-gray-600 font-medium">${new Date(e.datum).toLocaleDateString("de-DE")} <span class="text-gray-400 font-normal">(${e.von}-${e.bis} Uhr)</span></span>
                       <div class="flex items-center gap-3">
                         <span class="font-mono text-primary font-bold text-sm">${formatHours(e.stunden)}h</span>
                         <button onclick="window.adminEditEntry('${e.id}')" class="text-gray-300 hover:text-primary transition"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                         <button onclick="window.adminDeleteEntry('${e.id}')" class="text-gray-300 hover:text-red-500 transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                       </div>
                    </div>
                  `,
                    )
                    .join("");

            const kulanzToggle =
              hrs < goal
                ? `
                <div class="flex items-center justify-between border-t border-gray-100 pt-3 mt-1">
                   <div>
                     <div class="text-[11px] uppercase font-bold text-gray-700 tracking-wider">Auszahlung genehmigen (Zugeständnis)</div>
                     <div class="text-[10px] text-gray-400 mt-0.5">Fehlende Stunden müssen nachgeholt werden.</div>
                   </div>
                   <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" ${isFreigegeben ? "checked" : ""} onchange="window.adminToggleKulanz('${ul.id}', this.checked)" class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                   </label>
                </div>
              `
                : "";

            return `
             <div class="group flex flex-col transition-all border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <div class="p-3 cursor-pointer" onclick="document.getElementById('det-${ul.id}').classList.toggle('hidden')">
                   <div class="flex items-center ${bgLine} pl-3 text-sm justify-between">
                      <div>
                         <div class="font-bold text-gray-800 leading-tight">
                            ${ul.name}
                            ${ul.pausiert ? '<span class="text-[10px] font-bold text-orange-600 bg-orange-100 px-1 py-0.5 rounded uppercase ml-1">Pausiert</span>' : ""}
                            ${isAbgeschlossen ? '<span class="text-[10px] font-bold text-gray-600 bg-gray-200 px-1 py-0.5 rounded uppercase ml-1 flex items-center inline-flex gap-0.5"><i data-lucide="lock" class="w-3 h-3"></i> Abgeschlossen</span>' : ""}
                         </div>
                         <div class="text-[10px] text-secondary uppercase tracking-wider mt-0.5">${ul.einrichtung}</div>
                      </div>
                      <div class="flex items-center gap-3">
                         <div class="font-mono text-lg font-bold ${hrs > 0 ? "text-gray-900" : "text-gray-400"}">${formatHours(hrs)}</div>
                         <i data-lucide="chevron-down" class="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition"></i>
                      </div>
                   </div>
                </div>
                <!-- Details -->
                <div id="det-${ul.id}" class="hidden flex-col p-3 pt-0 ml-3 mr-3 mt-1">
                   <div class="mb-3">${statusUI}</div>
                   <div class="bg-white rounded-xl border border-gray-100 px-3 divide-y divide-gray-50 shadow-sm">${entriesHtml}</div>
                   ${kulanzToggle}
                </div>
             </div>
           `;
          })
          .join("");
        listDiv.innerHTML = html;
      };

      const renderAdminJahr = () => {
        const ys = STATE.adminYearStart;
        el("adminSelectedYearLabel").textContent = `März ${ys} - Feb ${ys + 1}`;
        const months = [];
        for (let i = 0; i < 12; i++) {
          let d = new Date(ys, 2 + i, 1);
          let ms = d.toISOString().substring(0, 7);
          months.push({
            key: ms,
            label: d.toLocaleDateString("de-DE", {
              month: "short",
              year: "2-digit",
            }),
          });
        }

        el("jahrTableHead").innerHTML =
          `<th class="p-3 sticky left-0 bg-gray-50 z-10 border-r border-gray-100 min-w-[140px]">Name</th>` +
          months
            .map((m) => `<th class="p-3 font-semibold">${m.label}</th>`)
            .join("");

        const goal = STATE.einstellungen.pflicht_stunden;
        const html = STATE.ulList
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((ul) => {
            let row = `<td class="p-3 sticky left-0 bg-white z-10 border-r border-gray-100 font-bold text-gray-800">${ul.name}</td>`;
            months.forEach((m) => {
              const hrs = STATE.entries
                .filter(
                  (e) => e.monat === m.key && e.uebungsleiter_id === ul.id,
                )
                .reduce((sum, e) => sum + e.stunden, 0);
              const isFreigegeben =
                hrs >= goal ||
                (STATE.freigaben[m.key] && STATE.freigaben[m.key][ul.id]);

              let classes = "text-gray-300";
              if (hrs > 0) classes = "text-gray-800";
              if (hrs >= goal) classes = "text-emerald-600 font-bold";
              else if (isFreigegeben) classes = "text-primary font-bold";

              row += `<td class="p-3 font-mono ${classes}">${formatHours(hrs)}</td>`;
            });
            return `<tr>${row}</tr>`;
          })
          .join("");
        el("jahrTableBody").innerHTML = html;
      };

      const renderAdminVerwaltung = () => {
        const list = el("adminVerwaltungList");
        list.innerHTML = STATE.ulList
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (ul) => `
            <div class="p-4 hover:bg-gray-50 flex justify-between items-center transition cursor-pointer" onclick="window.adminEditUser('${ul.id}')">
               <div>
                 <div class="font-bold text-gray-800">${ul.name} 
                    <span class="text-xs font-normal text-gray-400 ml-2 font-mono bg-gray-100 px-1.5 py-0.5 rounded">PIN: ${ul.pin}</span>
                    ${ul.pausiert ? '<span class="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded uppercase ml-2">Pausiert</span>' : ""}
                 </div>
                 <div class="text-[10px] uppercase text-secondary font-bold tracking-wider mt-0.5">${ul.einrichtung}</div>
               </div>
               <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300"></i>
            </div>
         `,
          )
          .join("");
      };

      // ---- Admin Handlers ----
      window.adminToggleKulanz = async (ulId, checked) => {
        await API.setFreigabe(STATE.adminMonthStr, ulId, checked);
        STATE.freigaben = await API.getFreigaben();
        renderAdminDashboard();
        showNotification(
          checked ? "Auszahlung genehmigt" : "Auszahlung widerrufen",
        );
      };

      window.adminDeleteEntry = async (entryId) => {
        if (!confirm("Eintrag sicher löschen?")) return;
        await API.deleteEintrag(entryId);
        STATE.entries = await API.getEintraege();
        renderAdminDashboard();
        showNotification("Eintrag gelöscht");
      };

      window.adminEditEntry = (entryId) => {
        const entry = STATE.entries.find((e) => e.id === entryId);
        if (!entry) return;
        el("entryModalId").value = entryId;
        el("entryModalDatum").value = entry.datum;
        el("entryModalVon").value = entry.von;
        el("entryModalBis").value = entry.bis;
        el("entryEditModal").classList.remove("hidden");
      };

      window.closeEntryModal = () => {
        el("entryEditModal").classList.add("hidden");
      };

      window.saveEntryModal = async () => {
        const entryId = el("entryModalId").value;
        const datum = el("entryModalDatum").value;
        const von = el("entryModalVon").value;
        const bis = el("entryModalBis").value;
        const stunden = calculateHours(von, bis);

        if (!datum || !von || !bis || stunden <= 0) return;

        await API.updateEintrag(entryId, {
          datum: datum,
          monat: datum.substring(0, 7),
          von: von,
          bis: bis,
          stunden: stunden,
        });

        STATE.entries = await API.getEintraege();
        window.closeEntryModal();
        renderAdminDashboard();
        showNotification("Eintrag aktualisiert");
      };

      // Month Selection
      el("adminPrevMonthBtn").addEventListener("click", () => {
        let [y, m] = STATE.adminMonthStr.split("-").map(Number);
        if (--m === 0) {
          m = 12;
          y--;
        }
        STATE.adminMonthStr = `${y}-${m.toString().padStart(2, "0")}`;
        renderAdminDashboard();
      });
      el("adminNextMonthBtn").addEventListener("click", () => {
        let [y, m] = STATE.adminMonthStr.split("-").map(Number);
        if (++m === 13) {
          m = 1;
          y++;
        }
        STATE.adminMonthStr = `${y}-${m.toString().padStart(2, "0")}`;
        renderAdminDashboard();
      });

      // Year Selection
      el("adminPrevYearBtn").addEventListener("click", () => {
        STATE.adminYearStart--;
        renderAdminDashboard();
      });
      el("adminNextYearBtn").addEventListener("click", () => {
        STATE.adminYearStart++;
        renderAdminDashboard();
      });

      // CSV Export Logic
      const exportCsv = (onlyAuszahlung) => {
        const goal = STATE.einstellungen.pflicht_stunden;
        let csv = "";

        if (onlyAuszahlung) {
          csv = "Vorname;Name;Klinik;Gesamtstunden;Auszahlung\n";
        } else {
          csv = "Einrichtung;Vorname;Name;Status;Gesamtstunden\n";
        }

        const monthEntries = STATE.entries.filter(
          (e) => e.monat === STATE.adminMonthStr,
        );

        STATE.ulList
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((ul) => {
            const hrs = monthEntries
              .filter((e) => e.uebungsleiter_id === ul.id)
              .reduce((sum, e) => sum + e.stunden, 0);
            let isFreigegeben =
              hrs >= goal ||
              (STATE.freigaben[STATE.adminMonthStr] &&
                STATE.freigaben[STATE.adminMonthStr][ul.id]);

            if (onlyAuszahlung && !isFreigegeben) return;

            const names = ul.name.split(" ");
            const lastName = names.pop() || "";
            const firstName = names.join(" ") || "";
            const clean = (s) => `"${(s || "").replace(/"/g, '""')}"`;
            const hrsStr = formatHours(hrs).replace(".", ",");

            if (onlyAuszahlung) {
              csv += `${clean(firstName)};${clean(lastName)};${clean(ul.einrichtung)};${hrsStr};Ja\n`;
            } else {
              let status = isFreigegeben
                ? hrs >= goal
                  ? "Ziel erreicht"
                  : "Zugeständnis"
                : "Nicht erreicht";
              csv += `${clean(ul.einrichtung)};${clean(firstName)};${clean(lastName)};${status};${hrsStr}\n`;
            }
          });

        const blob = new Blob(["\uFEFF" + csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `MSBW_${onlyAuszahlung ? "Lohnbuchhaltung" : "Alle"}_${STATE.adminMonthStr}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      const exportCsvJahr = () => {
        const ys = STATE.adminYearStart;
        const goal = STATE.einstellungen.pflicht_stunden;
        const yearlyGoal = goal * 12;

        let csv = "Vorname;Name;Einrichtung;";

        const months = [];
        for (let i = 0; i < 12; i++) {
          let d = new Date(ys, 2 + i, 1);
          let ms = d.toISOString().substring(0, 7);
          let label = d.toLocaleDateString("de-DE", {
            month: "short",
            year: "2-digit",
          });
          months.push({ key: ms, label: label });
          csv += `${label};`;
        }

        csv += "Soll Std. Jahr;Ist Std. Jahr;Differenz\n";

        STATE.ulList
          .sort((a, b) => a.name.localeCompare(b.name))
          .forEach((ul) => {
            const names = ul.name.split(" ");
            const lastName = names.pop() || "";
            const firstName = names.join(" ") || "";
            const clean = (s) => `"${(s || "").replace(/"/g, '""')}"`;

            let row = `${clean(firstName)};${clean(lastName)};${clean(ul.einrichtung)};`;

            let yearlyTotal = 0;
            months.forEach((m) => {
              const hrs = STATE.entries
                .filter(
                  (e) => e.monat === m.key && e.uebungsleiter_id === ul.id,
                )
                .reduce((sum, e) => sum + e.stunden, 0);
              yearlyTotal += hrs;
              row += `${formatHours(hrs).replace(".", ",")};`;
            });

            let diff = yearlyTotal - yearlyGoal;
            let diffStr =
              (diff > 0 ? "+" : "") + formatHours(diff).replace(".", ",");
            row += `${formatHours(yearlyGoal).replace(".", ",")};${formatHours(yearlyTotal).replace(".", ",")};${diffStr}\n`;

            csv += row;
          });

        const blob = new Blob(["\uFEFF" + csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `MSBW_Jahresübersicht_${ys}-${ys + 1}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      };

      el("exportCsvBtnJahr").addEventListener("click", () => exportCsvJahr());
      el("exportCsvBtnLohn").addEventListener("click", () => exportCsv(true));
      el("exportCsvBtnAlle").addEventListener("click", () => exportCsv(false));

      // User Management Modal
      window.adminEditUser = (id) => {
        const user = STATE.ulList.find((u) => u.id === id);
        el("ueModalId").value = id || "";
        el("ueModalName").value = user ? user.name : "";
        el("ueModalEinrichtung").value = user ? user.einrichtung : "";
        el("ueModalPin").value = user ? user.pin : "";
        el("ueModalTelefon").value = user ? user.telefon || "" : "";
        el("ueModalEmail").value = user ? user.email || "" : "";
        el("ueModalStatus").value =
          user && user.pausiert ? "pausiert" : "aktiv";
        el("ueModalAdresse").value = user ? user.adresse || "" : "";
        el("ueModalNotizen").value = user ? user.notizen || "" : "";
        el("ueModalTitle").textContent = user
          ? "Übungsleiter bearbeiten"
          : "Neuen anlegen";
        el("ueModalDeleteBtn").classList.toggle("hidden", !user);
        el("ueModalErrorName").classList.add("hidden");

        el("userEditModal").classList.remove("hidden");
      };

      window.closeUserModal = () => el("userEditModal").classList.add("hidden");

      window.saveUserModal = async () => {
        const id = el("ueModalId").value;
        const data = {
          name: el("ueModalName").value,
          einrichtung: el("ueModalEinrichtung").value,
          pin: el("ueModalPin").value,
          telefon: el("ueModalTelefon").value,
          email: el("ueModalEmail").value,
          pausiert: el("ueModalStatus").value === "pausiert",
          adresse: el("ueModalAdresse").value,
          notizen: el("ueModalNotizen").value,
        };
        if (!data.name || !data.pin) {
          el("ueModalErrorName").classList.remove("hidden");
          return;
        }

        if (id) await API.updateUebungsleiter(id, data);
        else await API.addUebungsleiter(data);

        STATE.ulList = await API.getUebungsleiterList();
        window.closeUserModal();
        renderAdminDashboard();
        showNotification("Übungsleiter gespeichert");
      };

      window.deleteUserModal = async () => {
        if (!confirm("Übungsleiter wirklich löschen?")) return;
        const id = el("ueModalId").value;
        if (USE_MOCK && dbMockState.uebungsleiter[id]) {
          delete dbMockState.uebungsleiter[id];
          saveMock();
          STATE.ulList = await API.getUebungsleiterList();
        }
        window.closeUserModal();
        renderAdminDashboard();
        showNotification("Übungsleiter gelöscht");
      };

      // ---- Boot up ----
      window.onload = () => {
        if (window.lucide) window.lucide.createIcons();
        setTimeout(initApp, 600); // slight delay for aesthetic loading effect
      };
    </script>
  </body>
</html>
