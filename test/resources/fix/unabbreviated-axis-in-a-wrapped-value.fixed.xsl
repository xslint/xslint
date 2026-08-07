<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="2.0">
  <xsl:template match="R">
    <xsl:value-of select="@a
                          or deep"/>
    <xsl:value-of select="@b &gt; 1 and later"/>
    <xsl:value-of select="alpha"/>
  </xsl:template>
</xsl:stylesheet>
