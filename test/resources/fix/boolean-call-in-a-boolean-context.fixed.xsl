<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:template match="/">
    <xsl:if test="not(@a)">
      <xsl:value-of select="@b and @c"/>
      <xsl:value-of select="@d and (e or f)"/>
      <xsl:value-of select="every $va in g satisfies $va/@h"/>
      <xsl:value-of select="@i" use-when="system-property('xsl:vendor')"/>
    </xsl:if>
  </xsl:template>
</xsl:stylesheet>
