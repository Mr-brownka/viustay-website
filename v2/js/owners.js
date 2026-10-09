// "List your property" 3-step form -> property_submissions table
document.addEventListener('DOMContentLoaded', function () {
  var V = window.V;
  var form = V.$('#lp-form');
  var ROLES = ['Owner', 'Manager / agency', 'Caretaker'];
  var TYPES = ['Bedsitter', 'Studio', '1 bedroom', '2 bedrooms', '3 bedrooms', '4+ bedrooms'];
  var params = new URLSearchParams(window.location.search);
  var state = { role: ROLES.indexOf(params.get('role')) >= 0 ? params.get('role') : 'Manager / agency', visit: null, step: 1 };

  function chipsInto(box, items, current, onPick) {
    box.innerHTML = '';
    items.forEach(function (it) {
      var label = it.label || it, value = it.value || it;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chip square'; b.textContent = label;
      b.setAttribute('aria-pressed', value === current ? 'true' : 'false');
      b.addEventListener('click', function () { onPick(value); });
      box.appendChild(b);
    });
  }

  function renderRoles() { chipsInto(V.$('#role-chips'), ROLES, state.role, function (v) { state.role = v; renderRoles(); }); }
  renderRoles();

  // Visit days: next 6 days, Mon–Sat
  var days = [], d = new Date();
  while (days.length < 6) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) days.push(new Date(d)); }
  var dayItems = days.map(function (x) { return { label: x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), value: x.toISOString().slice(0, 10) }; });
  state.visit = dayItems[1].value;
  function renderDays() { chipsInto(V.$('#visit-chips'), dayItems, state.visit, function (v) { state.visit = v; renderDays(); }); }
  renderDays();

  // Unit rows
  var unitsBox = V.$('#units');
  function addUnit(type) {
    var row = document.createElement('div');
    row.className = 'unit-row';
    row.innerHTML =
      '<label class="field">Unit type<select data-u="type">' + TYPES.map(function (t) { return '<option' + (t === type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label>' +
      '<label class="field">How many vacant<input data-u="count" type="number" min="1" value="1" inputmode="numeric"></label>' +
      '<label class="field">Rent (KES / month)<input data-u="rent" type="text" inputmode="numeric" placeholder="e.g. 38,000"></label>' +
      '<button type="button" class="btn btn-outline" style="font-size:15px;padding:10px">Remove</button>';
    V.$('button', row).addEventListener('click', function () { if (unitsBox.children.length > 1) row.remove(); });
    unitsBox.appendChild(row);
  }
  addUnit('1 bedroom');
  V.$('#add-unit').addEventListener('click', function () { addUnit('2 bedrooms'); });
  function readUnits() {
    return V.$$('.unit-row', unitsBox).map(function (r) {
      return { type: V.$('[data-u=type]', r).value, count: Number(V.$('[data-u=count]', r).value || 0), rent: V.num(V.$('[data-u=rent]', r).value) };
    });
  }

  function showError(step, msg) {
    var e = V.$('[data-error="' + step + '"]');
    if (!msg) { e.classList.add('hidden'); return false; }
    e.textContent = msg; e.classList.remove('hidden'); return true;
  }
  function validate(step) {
    if (step === 1) return !showError(1, !form.building_name.value.trim() ? 'Please enter the building name.' : !form.location.value.trim() ? 'Please enter the area or road.' : '');
    if (step === 2) {
      var bad = readUnits().some(function (u) { return u.count < 1 || !u.rent; });
      return !showError(2, bad ? 'Please fill in how many units and the rent for each row.' : '');
    }
    if (step === 3) {
      var email = form.contact_email.value.trim();
      return !showError(3, !form.contact_name.value.trim() ? 'Please enter your name.' :
        !V.phoneOk(form.contact_phone.value) ? 'Please enter a valid WhatsApp number.' :
        email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 'That email doesn\'t look right.' :
        !form.terms.checked ? 'Please accept the terms to continue.' : '');
    }
    return true;
  }
  function go(step) {
    if (step > state.step && !validate(state.step)) return;
    state.step = step;
    V.$$('[data-step-panel]').forEach(function (p) { p.classList.toggle('hidden', Number(p.getAttribute('data-step-panel')) !== step); });
    document.body.setAttribute('data-step', String(step));
    V.renderChrome();
    window.scrollTo(0, 0);
  }
  V.$$('[data-next]').forEach(function (b) { b.addEventListener('click', function () { go(Number(b.getAttribute('data-next'))); }); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate(3)) return;
    var btn = V.$('#lp-submit'); btn.disabled = true; btn.textContent = 'Submitting…';
    var row = {
      role: state.role,
      building_name: form.building_name.value.trim(),
      location: form.location.value.trim(),
      units: readUnits(),
      contact_name: form.contact_name.value.trim(),
      contact_phone: form.contact_phone.value.trim(),
      contact_email: form.contact_email.value.trim().toLowerCase() || null,
      visit_date: state.visit
    };
    V.insert('property_submissions', row).then(function () {
      form.classList.add('hidden');
      V.$('#lp-done').classList.remove('hidden');
      var day = dayItems.filter(function (x) { return x.value === state.visit; })[0];
      V.$('#lp-done-title').textContent = state.role === 'Caretaker' ? 'Thanks! We\'ll be in touch about the building.' : 'Thanks. We\'ll visit on ' + day.label + '.';
      if (row.contact_email) V.$('#lp-dash').href = 'dashboard.html?signup=1&email=' + encodeURIComponent(row.contact_email);
      document.body.setAttribute('data-steps', '0'); V.renderChrome();
      window.scrollTo(0, 0);
    }).catch(function (e2) {
      console.error(e2);
      showError(3, 'Something went wrong. Please try again or WhatsApp us.');
      btn.disabled = false; btn.textContent = 'Submit my listing';
    });
  });
});
