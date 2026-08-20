<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="lre">
  <xsl:template match="/">
    <foxtrot disable-output-escaping="yes">
      <xsl:copy-of select="alpha/node()"/>
    </foxtrot>
  </xsl:template>
</xsl:stylesheet>
