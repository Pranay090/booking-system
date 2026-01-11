#!/bin/bash
# Cron Configuration for Dynamic Pricing Job
# 
# This file provides examples for scheduling the offline pricing job
# using cron on Linux systems.

# ============================================================================
# INSTALLATION INSTRUCTIONS
# ============================================================================
# 
# 1. Make this script executable:
#    chmod +x scripts/setup_cron.sh
# 
# 2. Edit your crontab:
#    crontab -e
# 
# 3. Add one of the schedule examples below
# 
# 4. Save and exit (cron will automatically reload)
# 
# 5. Verify cron job is scheduled:
#    crontab -l

# ============================================================================
# CRON SCHEDULE EXAMPLES
# ============================================================================

# --- Option 1: Every 30 minutes (Recommended) ---
# */30 * * * * cd /home/pranay/Desktop/projects/booking-system/backend && npm run pricing-job >> /var/log/pricing-job.log 2>&1

# --- Option 2: Every hour ---
# 0 * * * * cd /home/pranay/Desktop/projects/booking-system/backend && npm run pricing-job >> /var/log/pricing-job.log 2>&1

# --- Option 3: Every 15 minutes (High frequency) ---
# */15 * * * * cd /home/pranay/Desktop/projects/booking-system/backend && npm run pricing-job >> /var/log/pricing-job.log 2>&1

# --- Option 4: Twice per hour (0 and 30 minutes) ---
# 0,30 * * * * cd /home/pranay/Desktop/projects/booking-system/backend && npm run pricing-job >> /var/log/pricing-job.log 2>&1

# --- Option 5: Business hours only (9 AM - 6 PM, every 30 mins) ---
# */30 9-18 * * * cd /home/pranay/Desktop/projects/booking-system/backend && npm run pricing-job >> /var/log/pricing-job.log 2>&1

# --- Option 6: With environment variables ---
# */30 * * * * cd /home/pranay/Desktop/projects/booking-system/backend && POSTGRES_HOST=localhost POSTGRES_DB=booking_system npm run pricing-job >> /var/log/pricing-job.log 2>&1

# ============================================================================
# CRON SYNTAX REFERENCE
# ============================================================================
# 
# ┌───────────── minute (0-59)
# │ ┌───────────── hour (0-23)
# │ │ ┌───────────── day of month (1-31)
# │ │ │ ┌───────────── month (1-12)
# │ │ │ │ ┌───────────── day of week (0-6, Sunday = 0)
# │ │ │ │ │
# * * * * * command to execute
# 
# Special characters:
# * = any value
# , = value list separator
# - = range of values
# / = step values

# ============================================================================
# LOG ROTATION (Optional but Recommended)
# ============================================================================
# 
# Create /etc/logrotate.d/pricing-job with:
# 
# /var/log/pricing-job.log {
#     daily
#     rotate 7
#     compress
#     delaycompress
#     missingok
#     notifempty
# }

# ============================================================================
# MONITORING
# ============================================================================

# Check if cron job is running:
# ps aux | grep pricing-job

# View recent logs:
# tail -f /var/log/pricing-job.log

# View cron execution logs:
# grep pricing-job /var/log/syslog

# ============================================================================
# TROUBLESHOOTING
# ============================================================================

# Problem: Cron job not executing
# Solution: Check cron service is running
#   sudo service cron status
#   sudo service cron start

# Problem: Command not found (npm)
# Solution: Use absolute path to npm
#   which npm
#   # Then use: /usr/bin/npm run pricing-job

# Problem: Environment variables not available
# Solution: Source environment in cron
#   */30 * * * * cd /home/pranay/Desktop/projects/booking-system/backend && source ~/.bashrc && npm run pricing-job

# Problem: Permission denied on log file
# Solution: Create log directory with correct permissions
#   sudo mkdir -p /var/log
#   sudo touch /var/log/pricing-job.log
#   sudo chown $USER:$USER /var/log/pricing-job.log
#   sudo chmod 644 /var/log/pricing-job.log

# ============================================================================
# SYSTEMD TIMER (Alternative to Cron)
# ============================================================================
# 
# For more robust scheduling, consider using systemd timers:
# 
# 1. Create /etc/systemd/system/pricing-job.service:
# 
# [Unit]
# Description=Dynamic Pricing Job
# 
# [Service]
# Type=oneshot
# WorkingDirectory=/home/pranay/Desktop/projects/booking-system/backend
# ExecStart=/usr/bin/npm run pricing-job
# User=pranay
# StandardOutput=journal
# StandardError=journal
# 
# 2. Create /etc/systemd/system/pricing-job.timer:
# 
# [Unit]
# Description=Run pricing job every 30 minutes
# 
# [Timer]
# OnBootSec=5min
# OnUnitActiveSec=30min
# 
# [Install]
# WantedBy=timers.target
# 
# 3. Enable and start:
# sudo systemctl enable pricing-job.timer
# sudo systemctl start pricing-job.timer
# 
# 4. Check status:
# sudo systemctl status pricing-job.timer
# sudo systemctl list-timers
# 
# 5. View logs:
# sudo journalctl -u pricing-job.service -f

# ============================================================================
# MANUAL TESTING
# ============================================================================

# Test job manually before scheduling:
# cd /home/pranay/Desktop/projects/booking-system/backend
# npm run pricing-job

# Test with different database:
# POSTGRES_DB=test_db npm run pricing-job

# Dry run (check what would be updated):
# Add a --dry-run flag to the script for testing

echo "Cron configuration examples loaded."
echo "Edit your crontab with: crontab -e"
echo "Recommended schedule: */30 * * * * (every 30 minutes)"
