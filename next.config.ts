import type { NextConfig } from 'next';

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

let basePath = '';
let assetPrefix = '';
if (isGithubActions && process.env.GITHUB_REPOSITORY) {

  const repo = process.env.GITHUB_REPOSITORY.replace(/.*\//, '');
  basePath = `/${repo}`;
  assetPrefix = `/${repo}/`;
}

const nextConfig: NextConfig = {

  agentRules: false,
  devIndicators: false,
  output: 'export',

  trailingSlash: true,
  basePath,
  assetPrefix,

  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  }
};

export default nextConfig;
