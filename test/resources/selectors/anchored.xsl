<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:my="urn:my" version="1.0">
  <xsl:template match="alpha"/>
  <xsl:function name="my:shallow"/>
  <xsl:template name="outer">
    <xsl:stylesheet version="1.0">
      <xsl:template match="beta"/>
      <xsl:function name="my:deep"/>
    </xsl:stylesheet>
  </xsl:template>
  <xsl:transform version="1.0"/>
</xsl:stylesheet>
