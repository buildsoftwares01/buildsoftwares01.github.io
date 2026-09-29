import { event } from '../event-config.js';
import { getReadinessIssues } from '../event-details.js';
const issues = getReadinessIssues(event);
if (issues.length) {
  console.error('The website works, but the invitation still needs these event details in event-config.js:');
  issues.forEach(issue => console.error(`- ${issue}`));
  process.exitCode = 1;
} else {
  console.log('All event details are configured. Build the site and publish dist/ using the hosting instructions.');
}
