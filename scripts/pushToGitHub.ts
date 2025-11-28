import { Octokit } from '@octokit/rest';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function main() {
  try {
    const octokit = await getUncachableGitHubClient();
    
    // Get authenticated user info
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`Authenticated as: ${user.login}`);
    console.log(`GitHub username: ${user.login}`);
    
    // Create the repository
    const repoName = 'bettrack';
    console.log(`\nCreating repository: ${repoName}...`);
    
    try {
      const { data: repo } = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: 'BetTrack - Sports Betting Tracker for NBA and NCAAF',
        private: false,
        auto_init: false,
      });
      
      console.log(`Repository created: ${repo.html_url}`);
      console.log(`\nClone URL: ${repo.clone_url}`);
      console.log(`SSH URL: ${repo.ssh_url}`);
    } catch (error: any) {
      if (error.status === 422) {
        console.log(`Repository '${repoName}' already exists.`);
        const { data: repo } = await octokit.repos.get({
          owner: user.login,
          repo: repoName,
        });
        console.log(`Existing repo URL: ${repo.html_url}`);
      } else {
        throw error;
      }
    }

    console.log('\n--- NEXT STEPS ---');
    console.log(`Run these commands in your Replit Shell to push the code:\n`);
    console.log(`git remote remove origin 2>/dev/null; git remote add origin https://github.com/${user.login}/${repoName}.git`);
    console.log(`git add -A`);
    console.log(`git commit -m "Initial commit - BetTrack app"`);
    console.log(`git branch -M main`);
    console.log(`git push -u origin main`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
