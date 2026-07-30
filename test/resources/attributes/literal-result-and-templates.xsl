<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0" id="templates">
  <xsl:template match="section">
    <widget test="count(item) = 0" label="{count(item) = 0}"/>
    <xsl:element name="{name(.)}">
      <xsl:value-of select="@x"/>
    </xsl:element>
  </xsl:template>
</xsl:stylesheet>
