(function(){
  'use strict';

  const TX_KEY = 'melGroup5BudgetTransactions';
  const BUDGET_KEY = 'melGroup5BudgetSettings';
  const CURRENCY_KEY = 'melGroup5Currency';
  const categories = ['Food','Transport','Bills','Education','Entertainment','Shopping','Health','Savings','Other'];
  const incomeCategories = ['Salary','Freelance','Gift','Investment','Other'];
  const palette = ['#2563eb','#16a34a','#f59e0b','#dc2626','#7c3aed','#0891b2','#ea580c','#0f766e','#64748b','#db2777'];

  document.addEventListener('DOMContentLoaded', function(){
    setActiveNav();
    bindGlobalControls();
    const page = document.body.dataset.page;
    if(page === 'dashboard') initDashboard();
    if(page === 'transactions') initTransactionsPage();
    if(page === 'budgets') initBudgetsPage();
    if(page === 'reports') initReportsPage();
    if(page === 'about') initAboutPage();
  });

  function getTransactions(){
    try { return JSON.parse(localStorage.getItem(TX_KEY)) || []; }
    catch(e){ return []; }
  }
  function saveTransactions(items){ localStorage.setItem(TX_KEY, JSON.stringify(items)); }
  function getBudgets(){
    try { return JSON.parse(localStorage.getItem(BUDGET_KEY)) || {monthly:0,categories:{}}; }
    catch(e){ return {monthly:0,categories:{}}; }
  }
  function saveBudgets(budgets){ localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets)); }
  function getCurrency(){ return localStorage.getItem(CURRENCY_KEY) || 'AUD'; }
  function setCurrency(code){ localStorage.setItem(CURRENCY_KEY, code); }

  function money(value){
    return new Intl.NumberFormat('en-AU',{style:'currency',currency:getCurrency(),maximumFractionDigits:2}).format(Number(value || 0));
  }
  function today(){ return new Date().toISOString().slice(0,10); }
  function currentMonth(){ return new Date().toISOString().slice(0,7); }
  function monthOf(date){ return (date || '').slice(0,7); }
  function uid(){ return 'tx-' + Date.now() + '-' + Math.random().toString(36).slice(2,8); }
  function byMonth(items, month){ return items.filter(tx => monthOf(tx.date) === month); }
  function sum(items, type){ return items.filter(tx => !type || tx.type === type).reduce((acc,tx) => acc + Number(tx.amount || 0), 0); }
  function groupExpenseByCategory(items){
    return items.filter(tx => tx.type === 'expense').reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + Number(tx.amount || 0);
      return acc;
    }, {});
  }
  function escapeHTML(value){
    return String(value || '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }

  function setActiveNav(){
    const path = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a').forEach(a => {
      const href = a.getAttribute('href');
      if(href === path || (path === '' && href === 'index.html')) a.classList.add('active');
    });
  }
  function bindGlobalControls(){
    const currency = document.querySelector('#currencySelect');
    if(currency){
      currency.value = getCurrency();
      currency.addEventListener('change', function(){ setCurrency(this.value); location.reload(); });
    }
    const sample = document.querySelector('#loadSampleData');
    if(sample){
      sample.addEventListener('click', function(){
        if(confirm('This will replace current demo data with sample transactions. Continue?')){
          loadSampleData(); location.reload();
        }
      });
    }
    const clear = document.querySelector('#clearAllData');
    if(clear){
      clear.addEventListener('click', function(){
        if(confirm('Delete all transactions and budgets from this browser?')){
          localStorage.removeItem(TX_KEY); localStorage.removeItem(BUDGET_KEY); location.reload();
        }
      });
    }
  }

  function loadSampleData(){
    const m = currentMonth();
    const sample = [
      {id:uid(), type:'income', category:'Salary', date:m+'-01', amount:3500, note:'Monthly salary'},
      {id:uid(), type:'expense', category:'Food', date:m+'-03', amount:310.50, note:'Groceries'},
      {id:uid(), type:'expense', category:'Transport', date:m+'-05', amount:120, note:'Public transport'},
      {id:uid(), type:'expense', category:'Bills', date:m+'-07', amount:455.25, note:'Electricity and internet'},
      {id:uid(), type:'expense', category:'Education', date:m+'-08', amount:180, note:'Course materials'},
      {id:uid(), type:'expense', category:'Entertainment', date:m+'-10', amount:95, note:'Cinema and meals'},
      {id:uid(), type:'income', category:'Freelance', date:m+'-12', amount:450, note:'Part-time work'},
      {id:uid(), type:'expense', category:'Shopping', date:m+'-15', amount:240, note:'Clothing'},
      {id:uid(), type:'expense', category:'Health', date:m+'-18', amount:70, note:'Medication'},
      {id:uid(), type:'expense', category:'Savings', date:m+'-20', amount:500, note:'Emergency fund'}
    ];
    saveTransactions(sample);
    saveBudgets({monthly:2200,categories:{Food:400,Transport:150,Bills:500,Education:200,Entertainment:120,Shopping:200,Health:100,Savings:500}});
  }

  function initDashboard(){
    setupTransactionForm('#quickForm');
    const txs = getTransactions();
    const month = currentMonth();
    renderSummaryCards(txs, month);
    renderRecent(txs.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6), '#recentTableBody');
    renderAlerts(month, '#alerts');
    drawDashboardCharts(txs, month);
  }

  function initTransactionsPage(){
    setupTransactionForm('#transactionForm');
    fillCategorySelects();
    setDefaultDate();
    renderTransactionsTable();
    const filters = ['#filterMonth','#filterType','#filterCategory','#searchText'];
    filters.forEach(sel => document.querySelector(sel)?.addEventListener('input', renderTransactionsTable));
  }

  function initBudgetsPage(){
    fillBudgetForm();
    const form = document.querySelector('#budgetForm');
    if(form){
      form.addEventListener('submit', function(e){
        e.preventDefault();
        const budgets = {monthly:Number(form.monthlyBudget.value || 0),categories:{}};
        categories.forEach(cat => {
          const input = form.querySelector('[name="budget_'+cat+'"]');
          budgets.categories[cat] = Number(input.value || 0);
        });
        saveBudgets(budgets);
        showMessage('#budgetMessage','Budget settings saved successfully.','good');
        renderBudgetStatus();
      });
    }
    renderBudgetStatus();
  }

  function initReportsPage(){
    const monthInput = document.querySelector('#reportMonth');
    if(monthInput) monthInput.value = currentMonth();
    monthInput?.addEventListener('change', renderReport);
    document.querySelector('#exportCsv')?.addEventListener('click', exportCSV);
    document.querySelector('#exportJson')?.addEventListener('click', exportJSON);
    document.querySelector('#printReport')?.addEventListener('click', () => window.print());
    renderReport();
  }

  function initAboutPage(){
    const stats = document.querySelector('#storageStatus');
    if(stats){
      const count = getTransactions().length;
      stats.textContent = count + ' transaction record' + (count === 1 ? '' : 's') + ' stored in this browser.';
    }
  }

  function fillCategorySelects(){
    document.querySelectorAll('[data-category-select]').forEach(select => {
      const typeSelect = document.querySelector(select.dataset.typeTarget || '#type');
      function refresh(){
        const list = typeSelect?.value === 'income' ? incomeCategories : categories;
        select.innerHTML = list.map(cat => `<option value="${cat}">${cat}</option>`).join('');
      }
      typeSelect?.addEventListener('change', refresh);
      refresh();
    });
  }

  function setDefaultDate(){
    document.querySelectorAll('input[type="date"]').forEach(input => { if(!input.value) input.value = today(); });
    document.querySelectorAll('input[type="month"]').forEach(input => { if(!input.value) input.value = currentMonth(); });
  }

  function setupTransactionForm(selector){
    const form = document.querySelector(selector);
    if(!form) return;
    const typeSelect = form.querySelector('[name="type"]');
    const categorySelect = form.querySelector('[name="category"]');
    function refreshCats(){
      const list = typeSelect.value === 'income' ? incomeCategories : categories;
      const selected = categorySelect.dataset.selected || categorySelect.value;
      categorySelect.innerHTML = list.map(cat => `<option value="${cat}">${cat}</option>`).join('');
      if(list.includes(selected)) categorySelect.value = selected;
      categorySelect.dataset.selected = '';
    }
    typeSelect.addEventListener('change', refreshCats);
    refreshCats();
    const dateInput = form.querySelector('[name="date"]');
    if(dateInput && !dateInput.value) dateInput.value = today();

    form.addEventListener('submit', function(e){
      e.preventDefault();
      if(!form.reportValidity()) return;
      const amount = Number(form.amount.value);
      if(amount <= 0){ showMessage(form.dataset.message || '#formMessage','Amount must be greater than zero.','danger'); return; }
      const items = getTransactions();
      const id = form.id.value || uid();
      const item = {id,type:form.type.value,category:form.category.value,date:form.date.value,amount,note:form.note.value.trim()};
      const index = items.findIndex(tx => tx.id === id);
      if(index >= 0) items[index] = item; else items.push(item);
      saveTransactions(items);
      form.reset();
      if(dateInput) dateInput.value = today();
      refreshCats();
      showMessage(form.dataset.message || '#formMessage', index >= 0 ? 'Transaction updated.' : 'Transaction added.','good');
      if(document.body.dataset.page === 'dashboard') initDashboard();
      if(document.body.dataset.page === 'transactions') renderTransactionsTable();
      if(document.body.dataset.page === 'reports') renderReport();
    });
  }

  function renderSummaryCards(txs, month){
    const items = byMonth(txs, month);
    const income = sum(items,'income');
    const expense = sum(items,'expense');
    const balance = income - expense;
    setText('#totalIncome', money(income));
    setText('#totalExpense', money(expense));
    setText('#netBalance', money(balance));
    setText('#transactionCount', String(items.length));
    const budget = getBudgets().monthly || 0;
    setText('#budgetUsed', budget ? Math.min(100, Math.round((expense / budget)*100)) + '%' : 'No budget');
  }

  function renderRecent(items, target){
    const tbody = document.querySelector(target);
    if(!tbody) return;
    if(!items.length){ tbody.innerHTML = `<tr><td colspan="5" class="empty">No transactions yet. Add income or expenses to begin.</td></tr>`; return; }
    tbody.innerHTML = items.map(tx => `
      <tr>
        <td>${escapeHTML(tx.date)}</td>
        <td><span class="badge ${tx.type}">${escapeHTML(tx.type)}</span></td>
        <td>${escapeHTML(tx.category)}</td>
        <td>${escapeHTML(tx.note || '-')}</td>
        <td><strong>${money(tx.amount)}</strong></td>
      </tr>`).join('');
  }

  function renderAlerts(month, target){
    const box = document.querySelector(target);
    if(!box) return;
    const txs = byMonth(getTransactions(), month);
    const expenses = sum(txs,'expense');
    const budgets = getBudgets();
    const grouped = groupExpenseByCategory(txs);
    const messages = [];
    if(budgets.monthly > 0){
      if(expenses > budgets.monthly) messages.push(`<div class="alert danger"><strong>Overspending alert:</strong> monthly expenses are ${money(expenses - budgets.monthly)} above the total budget.</div>`);
      else if(expenses > budgets.monthly * .8) messages.push(`<div class="alert"><strong>Warning:</strong> monthly spending has reached ${Math.round(expenses / budgets.monthly * 100)}% of the total budget.</div>`);
      else messages.push(`<div class="alert good"><strong>Healthy budget status:</strong> current expenses are still within the monthly budget.</div>`);
    } else {
      messages.push(`<div class="alert"><strong>No monthly budget set:</strong> add budget limits to activate overspending alerts.</div>`);
    }
    Object.entries(budgets.categories || {}).forEach(([cat, limit]) => {
      const spent = grouped[cat] || 0;
      if(limit > 0 && spent > limit) messages.push(`<div class="alert danger"><strong>${cat} alert:</strong> spending is ${money(spent - limit)} over the category budget.</div>`);
    });
    box.innerHTML = messages.join('');
  }

  function drawDashboardCharts(txs, month){
    const items = byMonth(txs, month);
    const exp = groupExpenseByCategory(items);
    drawPieChart(document.querySelector('#expensePie'), exp, '#expenseLegend');
    const income = sum(items,'income');
    const expense = sum(items,'expense');
    drawBarChart(document.querySelector('#incomeExpenseBar'), ['Income','Expenses'], [income, expense], '#barLegend');
  }

  function renderTransactionsTable(){
    const tbody = document.querySelector('#transactionsTableBody');
    if(!tbody) return;
    const month = document.querySelector('#filterMonth')?.value;
    const type = document.querySelector('#filterType')?.value;
    const category = document.querySelector('#filterCategory')?.value;
    const search = (document.querySelector('#searchText')?.value || '').toLowerCase();
    let items = getTransactions().slice().sort((a,b)=>b.date.localeCompare(a.date));
    if(month) items = items.filter(tx => monthOf(tx.date) === month);
    if(type) items = items.filter(tx => tx.type === type);
    if(category) items = items.filter(tx => tx.category === category);
    if(search) items = items.filter(tx => (tx.note + ' ' + tx.category + ' ' + tx.type).toLowerCase().includes(search));
    if(!items.length){ tbody.innerHTML = `<tr><td colspan="7" class="empty">No matching transaction records found.</td></tr>`; return; }
    tbody.innerHTML = items.map(tx => `
      <tr>
        <td>${escapeHTML(tx.date)}</td>
        <td><span class="badge ${tx.type}">${escapeHTML(tx.type)}</span></td>
        <td>${escapeHTML(tx.category)}</td>
        <td>${escapeHTML(tx.note || '-')}</td>
        <td><strong>${money(tx.amount)}</strong></td>
        <td>${escapeHTML(monthOf(tx.date))}</td>
        <td class="actions no-print">
          <button class="btn btn-outline" data-edit="${tx.id}">Edit</button>
          <button class="btn btn-danger" data-delete="${tx.id}">Delete</button>
        </td>
      </tr>`).join('');
    tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', function(){
      if(confirm('Delete this transaction?')){
        saveTransactions(getTransactions().filter(tx => tx.id !== this.dataset.delete));
        renderTransactionsTable();
      }
    }));
    tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', function(){
      const tx = getTransactions().find(item => item.id === this.dataset.edit);
      const form = document.querySelector('#transactionForm');
      if(tx && form){
        form.id.value = tx.id; form.type.value = tx.type; form.category.dataset.selected = tx.category;
        form.type.dispatchEvent(new Event('change'));
        form.category.value = tx.category; form.date.value = tx.date; form.amount.value = tx.amount; form.note.value = tx.note;
        form.scrollIntoView({behavior:'smooth',block:'start'});
      }
    }));
  }

  function fillBudgetForm(){
    const form = document.querySelector('#budgetForm');
    if(!form) return;
    const budgets = getBudgets();
    form.monthlyBudget.value = budgets.monthly || '';
    const box = document.querySelector('#categoryBudgetFields');
    if(box){
      box.innerHTML = categories.map(cat => `
        <label>${cat} monthly limit
          <input type="number" min="0" step="0.01" name="budget_${cat}" value="${budgets.categories?.[cat] || ''}" placeholder="0.00">
        </label>`).join('');
    }
  }

  function renderBudgetStatus(){
    const box = document.querySelector('#budgetStatus');
    if(!box) return;
    const month = currentMonth();
    const txs = byMonth(getTransactions(), month);
    const expenses = sum(txs,'expense');
    const budgets = getBudgets();
    const grouped = groupExpenseByCategory(txs);
    const totalPct = budgets.monthly ? Math.min(140, expenses / budgets.monthly * 100) : 0;
    const totalClass = totalPct >= 100 ? 'danger' : totalPct >= 80 ? 'warn' : 'good';
    let html = `<div class="card"><h3>Total monthly budget</h3><p>Current month: <strong>${month}</strong></p><p>Spent ${money(expenses)} of ${budgets.monthly ? money(budgets.monthly) : 'no budget set'}</p><div class="progress"><span class="${totalClass}" style="width:${Math.min(100,totalPct)}%"></span></div></div>`;
    html += '<div class="grid grid-3">' + categories.map(cat => {
      const limit = budgets.categories?.[cat] || 0;
      const spent = grouped[cat] || 0;
      const pct = limit ? Math.min(140, spent / limit * 100) : 0;
      const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'good';
      return `<div class="card"><h3>${cat}</h3><p>Spent <strong>${money(spent)}</strong> / ${limit ? money(limit) : 'No limit'}</p><div class="progress"><span class="${cls}" style="width:${Math.min(100,pct)}%"></span></div><p class="help">${limit ? (spent > limit ? money(spent-limit)+' over budget' : money(limit-spent)+' remaining') : 'Set a limit to track this category.'}</p></div>`;
    }).join('') + '</div>';
    box.innerHTML = html;
  }

  function renderReport(){
    const month = document.querySelector('#reportMonth')?.value || currentMonth();
    const items = byMonth(getTransactions(), month).sort((a,b)=>a.date.localeCompare(b.date));
    const income = sum(items,'income');
    const expense = sum(items,'expense');
    const balance = income - expense;
    setText('#reportIncome', money(income));
    setText('#reportExpense', money(expense));
    setText('#reportBalance', money(balance));
    setText('#reportTransactions', String(items.length));
    renderRecent(items, '#reportTableBody');
    drawPieChart(document.querySelector('#reportPie'), groupExpenseByCategory(items), '#reportLegend');
    drawBarChart(document.querySelector('#reportBar'), ['Income','Expenses','Balance'], [income, expense, balance], '#reportBarLegend');
    renderAlerts(month, '#reportAlerts');
  }

  function exportCSV(){
    const month = document.querySelector('#reportMonth')?.value || currentMonth();
    const items = byMonth(getTransactions(), month);
    const rows = [['Date','Type','Category','Note','Amount']].concat(items.map(tx => [tx.date, tx.type, tx.category, tx.note, tx.amount]));
    const csv = rows.map(row => row.map(cell => '"' + String(cell).replace(/"/g,'""') + '"').join(',')).join('\n');
    downloadFile(csv, `budget-report-${month}.csv`, 'text/csv');
  }
  function exportJSON(){
    const month = document.querySelector('#reportMonth')?.value || currentMonth();
    const payload = {month,currency:getCurrency(),transactions:byMonth(getTransactions(),month),budgets:getBudgets(),createdAt:new Date().toISOString()};
    downloadFile(JSON.stringify(payload,null,2), `budget-report-${month}.json`, 'application/json');
  }
  function downloadFile(content, filename, type){
    const blob = new Blob([content], {type});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(link.href);
    link.remove();
  }

  function drawPieChart(canvas, data, legendSelector){
    const legend = document.querySelector(legendSelector);
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const entries = Object.entries(data).filter(([,v]) => v > 0);
    const w = canvas.width = 520, h = canvas.height = 320;
    ctx.clearRect(0,0,w,h);
    if(!entries.length){
      ctx.fillStyle = '#64748b'; ctx.font = '18px Arial'; ctx.textAlign = 'center'; ctx.fillText('No expense data available', w/2, h/2);
      if(legend) legend.innerHTML = '';
      return;
    }
    const total = entries.reduce((a,[,v]) => a + v, 0);
    let start = -Math.PI/2;
    entries.forEach(([label,value], i) => {
      const angle = (value / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(w/2, h/2); ctx.arc(w/2, h/2, 110, start, start + angle); ctx.closePath();
      ctx.fillStyle = palette[i % palette.length]; ctx.fill();
      start += angle;
    });
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w/2,h/2,55,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#172033'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center'; ctx.fillText('Expenses', w/2, h/2 - 4);
    ctx.font = '14px Arial'; ctx.fillStyle = '#64748b'; ctx.fillText(money(total), w/2, h/2 + 18);
    if(legend){
      legend.innerHTML = entries.map(([label,value],i)=>`<span class="legend-item"><span class="swatch" style="background:${palette[i%palette.length]}"></span>${label}: ${money(value)}</span>`).join('');
    }
  }

  function drawBarChart(canvas, labels, values, legendSelector){
    const legend = document.querySelector(legendSelector);
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = 560, h = canvas.height = 320;
    ctx.clearRect(0,0,w,h);
    const max = Math.max(...values.map(v => Math.abs(v)), 1);
    const baseY = h - 55;
    ctx.strokeStyle = '#d9e2ef'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(45,baseY); ctx.lineTo(w-25,baseY); ctx.stroke();
    const gap = (w-90)/labels.length;
    labels.forEach((label,i) => {
      const val = values[i] || 0;
      const barH = Math.abs(val)/max * 190;
      const x = 60 + i*gap + gap*.18;
      const y = val >= 0 ? baseY - barH : baseY;
      ctx.fillStyle = palette[i % palette.length];
      ctx.fillRect(x,y,gap*.58,barH);
      ctx.fillStyle = '#172033'; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center';
      ctx.fillText(label, x + gap*.29, baseY + 22);
      ctx.fillStyle = '#64748b'; ctx.font = '12px Arial';
      ctx.fillText(money(val), x + gap*.29, y - 8);
    });
    if(legend){
      legend.innerHTML = labels.map((label,i)=>`<span class="legend-item"><span class="swatch" style="background:${palette[i%palette.length]}"></span>${label}</span>`).join('');
    }
  }

  function showMessage(selector, message, type){
    const el = document.querySelector(selector);
    if(el){
      el.className = 'alert ' + (type || '');
      el.textContent = message;
      setTimeout(()=>{ el.textContent=''; el.className=''; }, 3500);
    }
  }
  function setText(selector, text){ const el = document.querySelector(selector); if(el) el.textContent = text; }
})();
