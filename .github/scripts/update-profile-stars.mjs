import { readFile, writeFile } from 'node:fs/promises';

const username = 'leticiaisilveira';
const apiHeaders = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(process.env.GITHUB_TOKEN && {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
  }),
};

async function fetchAllPages(endpoint, query = {}) {
  const results = [];

  for (let page = 1; ; page += 1) {
    const url = new URL(`https://api.github.com/users/${username}/${endpoint}`);
    url.search = new URLSearchParams({
      ...query,
      per_page: '100',
      page: String(page),
    });
    const response = await fetch(url, { headers: apiHeaders });

    if (!response.ok) {
      throw new Error(
        `GitHub API request failed (${response.status}): ${await response.text()}`,
      );
    }

    const items = await response.json();
    if (!Array.isArray(items)) {
      throw new Error(`Unexpected GitHub API response for ${endpoint}`);
    }

    results.push(...items);
    if (items.length < 100) {
      return results;
    }
  }
}

const [repositories, starredRepositories] = await Promise.all([
  fetchAllPages('repos', { type: 'owner' }),
  fetchAllPages('starred'),
]);

const starredByOwner = new Set(
  starredRepositories.map((repository) => repository.full_name.toLowerCase()),
);
const totalStars = repositories.reduce((total, repository) => {
  if (
    !Number.isInteger(repository.stargazers_count) ||
    repository.stargazers_count < 0
  ) {
    throw new Error(`Invalid star count for ${repository.full_name}`);
  }

  return starredByOwner.has(repository.full_name.toLowerCase())
    ? total
    : total + repository.stargazers_count;
}, 0);

const readmePath = new URL('../../README.md', import.meta.url);
const readme = await readFile(readmePath, 'utf8');
const marker = /<!-- profile-stars:start -->\d+<!-- profile-stars:end -->/;

if (!marker.test(readme)) {
  throw new Error('Could not find the profile stars marker in README.md');
}

const updatedReadme = readme.replace(
  marker,
  `<!-- profile-stars:start -->${totalStars}<!-- profile-stars:end -->`,
);

if (process.argv.includes('--dry-run')) {
  console.log(`Stars excluding your own stars: ${totalStars}`);
} else if (updatedReadme !== readme) {
  await writeFile(readmePath, updatedReadme);
  console.log(`Updated README.md with ${totalStars} stars.`);
} else {
  console.log(`README.md is already up to date (${totalStars} stars).`);
}
