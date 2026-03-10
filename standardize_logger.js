const fs = require('fs');
const path = require('path');

function walk(dir) {
	let results = [];
	const list = fs.readdirSync(dir);
	list.forEach((file) => {
		file = path.join(dir, file);
		const stat = fs.statSync(file);
		if (stat && stat.isDirectory()) {
			results = results.concat(walk(file));
		} else if (file.endsWith('.ts') || file.endsWith('.svelte')) {
			results.push(file);
		}
	});
	return results;
}

const files = walk('src');
let changedCount = 0;

files.forEach((file) => {
	let content = fs.readFileSync(file, 'utf8');
	let original = content;

	// Replace logger.error('msg', err) with logger.error(err, 'msg')
	// Regex matches: logger.error( [quote] message [quote], variable )
	content = content.replace(
		/logger\.(error|warn|info|debug)\((['"`][^'"`]+['"`]),\s*([a-zA-Z0-9_]+)\)/g,
		'logger.$1($3, $2)'
	);

	if (content !== original) {
		fs.writeFileSync(file, content, 'utf8');
		changedCount++;
		console.log(`Updated ${file}`);
	}
});

console.log(`Updated ${changedCount} files.`);
