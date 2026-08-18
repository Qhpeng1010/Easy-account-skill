import { readFileSync } from 'node:fs';

export const PRD_HEADINGS = [
  '## 1. 文档变更日志',
  '## 2. 需求分析',
  '### 2.1 需求背景',
  '### 2.2 现状问题',
  '### 2.3 解决思路',
  '### 2.4 价值评估',
  '### 2.5 需求范围',
  '## 3. 目标',
  '### 3.1 设计目标',
  '### 3.2 目标客户',
  '### 3.3 目标排期',
  '## 4. 设计概要',
  '### 4.1 主要业务流程和业务名词定义',
  '### 4.2 关键模型定义',
  '### 4.3 功能定义',
  '### 4.4 接口',
  '### 4.5 原型',
  '### 4.6 非功能性需求',
  '### 4.7 灰度策略',
  '### 4.8 存量数据处理方案',
  '### 4.9 资金风险及应对方案',
  '### 4.10 与风控接口对接设计',
  '## 5. 附录',
  '### 5.1 相关文档',
  '### 5.2 遗留问题',
  '### 5.3 会议纪要'
];

export const PRD_TABLE_HEADERS = [
  '| 时间 | 版本号 | 变更人 | 主要变更内容 |',
  '| 功能模块 | 功能点 | 功能描述 | 所在系统/应用 | 优先级 |',
  '| 改动点入口 | 改动点路径 | 改动点描述 | 示例图 | 优先级 |',
  '| 目录 | 优先级 |'
];

export function validatePrdSource(source) {
  const errors = [];
  if (!/^# 【[^】]+】\d{8}-.+/m.test(source)) errors.push('PRD title must match 【产品模块】YYYYMMDD-需求名称.');
  if (!/飞书项目链接[：:]/.test(source)) errors.push('PRD must include the Feishu project link field.');
  if (!/一句话需求说明[：:]/.test(source)) errors.push('PRD must include the one-sentence requirement field.');
  let previous = -1;
  for (const heading of PRD_HEADINGS) {
    const index = source.indexOf(heading);
    if (index < 0) errors.push(`Missing PRD heading: ${heading}.`);
    else if (index <= previous) errors.push(`PRD heading is out of order: ${heading}.`);
    else previous = index;
  }
  for (const header of PRD_TABLE_HEADERS) {
    if (!source.includes(header)) errors.push(`Missing PRD table header: ${header}.`);
  }
  if (/\[(?:待补充|TODO|TBD)[^\]]*\]/i.test(source)) errors.push('Use [待确认：具体问题] instead of unfinished template placeholders.');
  return errors;
}

export function validatePrdFile(file) {
  const errors = validatePrdSource(readFileSync(file, 'utf8'));
  if (errors.length) throw new Error(errors.join('\n'));
}
