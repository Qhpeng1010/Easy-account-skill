window.createMerchantPreview = function () {
  const rows = [
    ["50225024-7129", "每日推荐视频集", "每日推荐视频集", "定向地标", "定向地标", "13899990000", "未绑定", "muted"],
    ["51525367-5027", "国际新闻集合", "国际新闻集合", "精准人群", "精准人群", "492", "已绑定", "success"],
    ["37700763-4766", "国际新闻集合", "国际新闻集合", "定向地标", "定向地标", "492", "绑定中", "info"],
    ["79023141-6582", "抖音短视频选集", "抖音短视频选集", "定向地标", "定向地标", "492", "绑定失败", "danger"],
    ["66322694-9281", "抖音短视频选集", "抖音短视频选集", "精准人群", "精准人群", "492", "异常", "warning"],
    ["94433958-2553", "抖音短视频选集", "抖音短视频选集", "定向地标", "定向地标", "492", "待开通", "info"],
    ["18322363-5921", "每日推荐视频集", "每日推荐视频集", "精准人群", "精准人群", "492", "未开通", "muted"],
    ["51345618-6812", "抖音短视频选集", "抖音短视频选集", "精准人群", "精准人群", "492", "已开通", "muted"],
  ];
  const content = document.createElement("div");
  content.className = "merchant-preview";
  content.innerHTML = `
    <section class="ea-card merchant-query">
      ${["门店ID|请输入商户编号", "门店名称|请输入商户名称", "商户简称|请输入商户简称", "联系人|请输入联系人姓名", "商户编号|请输入商户编号", "商户名称|请输入商户名称", "商户简称|请输入商户简称", "联系人|请输入联系人姓名"]
        .map((field) => field.split("|"))
        .map(([label, placeholder]) => `<label class="merchant-field"><span>${label}</span><input class="ea-input" placeholder="${placeholder}" /></label>`)
        .join("")}
      <div class="merchant-query__actions"><button class="ea-btn">↻　重置</button><button class="ea-btn ea-btn--primary">⌕　查询</button></div>
    </section>
    <section class="ea-card merchant-table-card">
      <div class="merchant-toolbar">
        <div class="merchant-tabs"><button class="merchant-tab is-active">全部门店(12)</button><button class="merchant-tab">直营门店(9)</button><button class="merchant-tab">加盟门店(9)</button></div>
        <div class="merchant-actions"><button class="ea-btn">⇧　导出</button><button class="ea-btn ea-btn--primary">＋ 新建门店</button></div>
      </div>
      <div class="merchant-table-wrap"><table class="merchant-table">
        <thead><tr><th>商户编号</th><th>商户名称/签约名</th><th>商户简称</th><th>商户角色</th><th>一级 / 二级行业</th><th>联系电话</th><th>商户状态</th><th>操作</th></tr></thead>
        <tbody>${rows.map((row) => `<tr>${row.slice(0, 6).map((cell) => `<td>${cell}</td>`).join("")}<td><span class="ea-status ea-status--${row[7]}">${row[6]}</span></td><td><a href="#">查看</a><a href="#">编辑</a><a href="#">营业渠道绑定</a></td></tr>`).join("")}</tbody>
      </table></div>
      <div class="merchant-pagination"><span class="merchant-pagination__total">共100条</span><div class="merchant-pagination__controls"><button class="merchant-page">‹</button><button class="merchant-page is-active">1</button><button class="merchant-page">2</button><button class="merchant-page">3</button><button class="merchant-page">4</button><button class="merchant-page">5</button><span>…</span><button class="merchant-page">10</button><button class="merchant-page">›</button><button class="ea-btn">10条/页⌄</button></div></div>
    </section>`;
  return content;
};
