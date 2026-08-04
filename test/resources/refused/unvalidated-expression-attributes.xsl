<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="3.0" id="unvalidated">
  <xsl:output encoding="UTF-8" method="xml"/>
  <xsl:template match="/">
    <xsl:variable name="alpha" use-when="1 +" select="beta"/>
    <xsl:merge>
      <xsl:merge-source for-each-item="2 +" select="doc">
        <xsl:merge-key select="gamma"/>
      </xsl:merge-source>
      <xsl:merge-source for-each-source="3 +" select="other">
        <xsl:merge-key select="delta"/>
      </xsl:merge-source>
    </xsl:merge>
  </xsl:template>
</xsl:stylesheet>
