# Load environment variables from .env.local
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1]
        $value = $matches[2]
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

# Run the script with arguments
$script = $args[0]
if ($args.Length -gt 1) {
    $scriptArgs = $args[1..($args.Length-1)]
    & node_modules\.bin\tsx $script $scriptArgs
} else {
    & node_modules\.bin\tsx $script
}
