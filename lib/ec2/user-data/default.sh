#!/bin/bash

# -x to display the command to be executed
set -xeu

# Redirect /var/log/user-data.log and /dev/console
exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

# Install Packages
token=$(curl \
  -s \
  -X PUT \
  -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" \
  "http://169.254.169.254/latest/api/token"
)
region_name=$(curl \
  -s \
  -H "X-aws-ec2-metadata-token: $token" \
  "http://169.254.169.254/latest/meta-data/placement/availability-zone" \
  | sed -e 's/.$//'
)

dnf install -y \
  "https://s3.${region_name}.amazonaws.com/amazon-ssm-${region_name}/latest/linux_amd64/amazon-ssm-agent.rpm" \
  unzip

# SSM Agent
systemctl enable --now amazon-ssm-agent

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
sudo ./aws/install
rm -rf aws
rm -rf awscliv2.zip
