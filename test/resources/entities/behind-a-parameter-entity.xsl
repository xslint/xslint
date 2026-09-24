<?xml version="1.0" encoding="UTF-8"?>
<!--
* SPDX-FileCopyrightText: Copyright (c) 2025-2026 Max Trunnikov
* SPDX-License-Identifier: MIT
-->
<!DOCTYPE xsl:stylesheet [
<!ENTITY % shared SYSTEM "shared.ent">
<!ENTITY % absent PUBLIC "-//xslint//absent" 'absent.ent'>
%shared;
%absent;
]>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0" id="entities">
  <xsl:output encoding="UTF-8" method="xml"/>
  <xsl:template match="gamma">
    <xsl:value-of select="count(&everything;)"/>
  </xsl:template>
</xsl:stylesheet>
