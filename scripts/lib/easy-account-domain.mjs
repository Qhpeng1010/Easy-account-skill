import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DOMAIN_PATH = 'modules/easy-account/domain.json';

function normalizeProductName(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\s_-]+/g, '');
}

function findMatches(request, candidates) {
  const normalizedRequest = normalizeProductName(request);
  return candidates.filter((candidate) => normalizedRequest.includes(normalizeProductName(candidate)));
}

export function readEasyAccountRouting(root = process.cwd()) {
  const domain = JSON.parse(readFileSync(resolve(root, DOMAIN_PATH), 'utf8'));
  if (!domain.routing) throw new Error('Easy Account domain routing is not configured.');
  return domain.routing;
}

export function resolveEasyAccountDomain(rawRequest, root = process.cwd()) {
  const request = String(rawRequest ?? '').trim();
  const routing = readEasyAccountRouting(root);
  const matchedAliases = findMatches(request, routing.aliases || []);
  const matchedExcludedProducts = findMatches(request, routing.excludedProducts || []);

  if (matchedAliases.length && matchedExcludedProducts.length) {
    return {
      status: 'clarify-target',
      system: null,
      matchedAliases,
      matchedExcludedProducts,
      question: '需求同时提到易账通和其他业务系统，请明确本次要交付的目标系统。'
    };
  }

  if (matchedExcludedProducts.length) {
    return {
      status: 'outside-domain',
      system: null,
      matchedAliases,
      matchedExcludedProducts,
      reason: `目标属于其他业务系统：${matchedExcludedProducts.join('、')}`
    };
  }

  if (matchedAliases.length) {
    return {
      status: 'matched',
      system: 'easy-account',
      canonicalName: routing.canonicalName,
      matchedAliases,
      matchedExcludedProducts
    };
  }

  return {
    status: routing.defaultWhenProductOmitted ? 'defaulted' : 'unresolved',
    system: routing.defaultWhenProductOmitted ? 'easy-account' : null,
    canonicalName: routing.defaultWhenProductOmitted ? routing.canonicalName : null,
    matchedAliases,
    matchedExcludedProducts,
    reason: routing.defaultWhenProductOmitted
      ? '当前技能是易账通专用入口，未指定产品名称时默认归属易账通。'
      : '请求未包含可识别的产品名称。'
  };
}
