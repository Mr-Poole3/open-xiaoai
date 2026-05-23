#!/usr/bin/env bash
# Shared SSH options for XiaoAI speaker (legacy ssh-rsa host keys).
SPEAKER_SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o HostKeyAlgorithms=+ssh-rsa
  -o PubkeyAcceptedAlgorithms=+ssh-rsa
)
