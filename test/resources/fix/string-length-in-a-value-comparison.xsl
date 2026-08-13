<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:if test="string-length(@name) eq 0">
      <xsl:value-of select="string-length(@title) ne 0"/>
      <xsl:value-of select="0 lt string-length(@note)"/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
